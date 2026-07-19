import {
  MembershipRole,
  MembershipStatus,
} from "@prisma/client";
import request from "supertest";
import { createApp } from "../src/app";
import { env } from "../src/config/env";
import { prisma } from "../src/lib/prisma";
import { clearRateLimitBuckets } from "../src/middleware/rate-limit";
import { hashPassword } from "../src/modules/auth/auth-password";
import {
  cleanupExpiredDemoWorkspaces,
  consumePrivateDemoAiRequestBudget,
} from "../src/modules/demo-workspace/demo-workspace.service";
import { describeIfDb, resetDatabase } from "./helpers/db";

describeIfDb("private demo workspace api integration", () => {
  const app = createApp();

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    clearRateLimitBuckets();
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  it("creates an isolated authenticated workspace with a completable Golden Demo scenario", async () => {
    const response = await request(app)
      .post("/api/auth/demo-session")
      .set("User-Agent", "demo-integration-test")
      .send({});

    expect(response.status).toBe(201);
    expect(response.body.data.refreshToken).toBeUndefined();
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.availableTenants).toHaveLength(1);
    expect(response.body.data.demoWorkspace).toMatchObject({
      templateVersion: "golden-demo.v1",
      scenario: {
        customerName: "Aiden Murphy",
        staffName: "Sofia Nguyen",
        timezone: "Australia/Melbourne",
        localStartTime: "14:00",
        localEndTime: "15:00",
        serviceAddress: "18 Collins Street, Melbourne VIC 3000",
      },
    });

    const cookies = response.headers["set-cookie"] as string[] | undefined;
    const refreshCookie = cookies?.find((cookie) =>
      cookie.startsWith("opsflow_refresh="),
    );
    expect(refreshCookie).toContain("HttpOnly");
    expect(refreshCookie).toContain("Path=/api/auth");
    expect(refreshCookie).toMatch(/Max-Age=3[0-6]\d\d/u);

    const tenantId = response.body.data.currentTenant.tenantId as string;
    const ownerId = response.body.data.user.id as string;
    const scenario = response.body.data.demoWorkspace.scenario as {
      localDate: string;
      localStartTime: string;
      localEndTime: string;
      suggestedPrompt: string;
      serviceAddress: string;
    };
    const workspace = await prisma.demoWorkspace.findUniqueOrThrow({
      where: { tenantId },
      include: {
        users: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    expect(workspace.users).toHaveLength(3);
    expect(workspace.users.map((user) => user.displayName)).toEqual(
      expect.arrayContaining(["Demo Visitor", "Sofia Nguyen", "Liam O'Connor"]),
    );
    expect(workspace.expiresAt.getTime() - workspace.createdAt.getTime()).toBeGreaterThan(
      55 * 60 * 1000,
    );

    const [customer, staffMembership, existingJobs] = await Promise.all([
      prisma.customer.findFirst({
        where: { tenantId, name: "Aiden Murphy" },
      }),
      prisma.membership.findFirst({
        where: {
          tenantId,
          role: MembershipRole.STAFF,
          status: MembershipStatus.ACTIVE,
          user: { displayName: "Sofia Nguyen" },
        },
        include: { user: true },
      }),
      prisma.job.findMany({ where: { tenantId } }),
    ]);

    expect(customer).not.toBeNull();
    expect(staffMembership?.user.displayName).toBe("Sofia Nguyen");
    expect(existingJobs).toHaveLength(2);
    expect(existingJobs.some((job) => job.scheduledStartAt)).toBe(true);
    expect(scenario.suggestedPrompt).toContain("Aiden Murphy");
    expect(scenario.suggestedPrompt).toContain("Sofia Nguyen");
    expect(scenario.suggestedPrompt).toContain(scenario.localDate);
    expect(scenario.suggestedPrompt).toContain(scenario.serviceAddress);

    const proposedStartAt = new Date(
      `${scenario.localDate}T${scenario.localStartTime}:00+10:00`,
    );
    const proposedEndAt = new Date(
      `${scenario.localDate}T${scenario.localEndTime}:00+10:00`,
    );
    const conflicts = await prisma.job.count({
      where: {
        tenantId,
        assignedToId: staffMembership?.userId,
        scheduledStartAt: { lt: proposedEndAt },
        scheduledEndAt: { gt: proposedStartAt },
      },
    });
    expect(conflicts).toBe(0);

    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${response.body.data.accessToken}`);
    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.demoWorkspace).toEqual(
      response.body.data.demoWorkspace,
    );
    expect(meResponse.body.data.user.id).toBe(ownerId);

    const refreshResponse = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookies ?? [])
      .send({});
    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.data.demoWorkspace).toEqual(
      response.body.data.demoWorkspace,
    );
  });

  it("gives concurrent visitors separate tenants and data", async () => {
    const [first, second] = await Promise.all([
      request(app).post("/api/auth/demo-session").send({}),
      request(app).post("/api/auth/demo-session").send({}),
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.user.id).not.toBe(second.body.data.user.id);
    expect(first.body.data.currentTenant.tenantId).not.toBe(
      second.body.data.currentTenant.tenantId,
    );

    const customerCounts = await Promise.all(
      [first, second].map((result) =>
        prisma.customer.count({
          where: {
            tenantId: result.body.data.currentTenant.tenantId,
            name: "Aiden Murphy",
          },
        }),
      ),
    );
    expect(customerCounts).toEqual([1, 1]);
  });

  it("rejects expired demo access and refresh sessions before rotation", async () => {
    const accessDemo = await request(app).post("/api/auth/demo-session").send({});
    const refreshDemo = await request(app).post("/api/auth/demo-session").send({});
    const expiredAt = new Date(Date.now() - 60_000);

    await prisma.demoWorkspace.updateMany({
      where: {
        tenantId: {
          in: [
            accessDemo.body.data.currentTenant.tenantId,
            refreshDemo.body.data.currentTenant.tenantId,
          ],
        },
      },
      data: { expiresAt: expiredAt },
    });

    const accessResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessDemo.body.data.accessToken}`);
    expect(accessResponse.status).toBe(401);
    expect(accessResponse.body.code).toBe("AUTH_SESSION_EXPIRED");

    const refreshCookies = refreshDemo.headers["set-cookie"] as string[] | undefined;
    const refreshResponse = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", refreshCookies ?? [])
      .send({});
    expect(refreshResponse.status).toBe(401);
    expect(refreshResponse.body.code).toBe("AUTH_SESSION_EXPIRED");
  });

  it("prevents demo identities and tenants from crossing administration boundaries", async () => {
    const demo = await request(app).post("/api/auth/demo-session").send({});
    const accessToken = demo.body.data.accessToken as string;
    const tenantId = demo.body.data.currentTenant.tenantId as string;
    const ownerId = demo.body.data.user.id as string;
    const ownerMembership = await prisma.membership.findUniqueOrThrow({
      where: {
        userId_tenantId: { userId: ownerId, tenantId },
      },
    });

    const [invite, listInvitations, switchTenant, updateMembership] =
      await Promise.all([
        request(app)
          .post(`/api/tenants/${tenantId}/invitations`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ email: "someone@example.com", role: "STAFF" }),
        request(app)
          .get("/api/invitations/mine")
          .set("Authorization", `Bearer ${accessToken}`),
        request(app)
          .post("/api/auth/switch-tenant")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ tenantId }),
        request(app)
          .patch(`/api/memberships/${ownerMembership.id}`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ role: "MANAGER" }),
      ]);

    for (const result of [invite, listInvitations, switchTenant, updateMembership]) {
      expect(result.status).toBe(403);
      expect(result.body.code).toBe("DEMO_ACTION_NOT_ALLOWED");
    }

    await prisma.user.update({
      where: { id: ownerId },
      data: { passwordHash: await hashPassword("known-password") },
    });
    const regularLogin = await request(app).post("/api/auth/login").send({
      email: demo.body.data.user.email,
      password: "known-password",
    });
    expect(regularLogin.status).toBe(401);
    expect(regularLogin.body.code).toBe("AUTH_INVALID_CREDENTIALS");
  });

  it("cleans an expired workspace in bounded batches without touching shared data", async () => {
    const passwordHash = await hashPassword("shared-password");
    const sharedTenant = await prisma.tenant.create({
      data: { name: "Shared Demo", slug: "shared-demo-preserved" },
    });
    const sharedUser = await prisma.user.create({
      data: {
        email: "shared-demo@example.com",
        passwordHash,
        displayName: "Shared Demo User",
      },
    });
    await prisma.membership.create({
      data: {
        tenantId: sharedTenant.id,
        userId: sharedUser.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });

    const first = await request(app).post("/api/auth/demo-session").send({});
    const second = await request(app).post("/api/auth/demo-session").send({});
    const demoTenantIds = [
      first.body.data.currentTenant.tenantId as string,
      second.body.data.currentTenant.tenantId as string,
    ];
    await prisma.demoWorkspace.updateMany({
      where: { tenantId: { in: demoTenantIds } },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const cleanup = await cleanupExpiredDemoWorkspaces({ limit: 1 });
    expect(cleanup).toEqual({ claimed: 1, deleted: 1, failed: 0 });
    expect(await prisma.demoWorkspace.count()).toBe(1);
    await expect(
      prisma.tenant.findUniqueOrThrow({ where: { id: sharedTenant.id } }),
    ).resolves.toMatchObject({ slug: "shared-demo-preserved" });
    await expect(
      prisma.user.findUniqueOrThrow({ where: { id: sharedUser.id } }),
    ).resolves.toMatchObject({ email: "shared-demo@example.com" });

    const remainingCleanup = await cleanupExpiredDemoWorkspaces({ limit: 10 });
    expect(remainingCleanup).toEqual({ claimed: 1, deleted: 1, failed: 0 });
    expect(await prisma.demoWorkspace.count()).toBe(0);
    expect(
      await prisma.user.count({
        where: { demoWorkspaceId: { not: null } },
      }),
    ).toBe(0);
  });

  it("enforces a global active-workspace capacity inside the creation lock", async () => {
    const previousMaxActive = env.DEMO_WORKSPACE_MAX_ACTIVE;
    env.DEMO_WORKSPACE_MAX_ACTIVE = 1;

    try {
      const first = await request(app).post("/api/auth/demo-session").send({});
      const second = await request(app).post("/api/auth/demo-session").send({});

      expect(first.status).toBe(201);
      expect(second.status).toBe(503);
      expect(second.body.code).toBe("DEMO_WORKSPACE_CAPACITY_REACHED");
      expect(await prisma.demoWorkspace.count()).toBe(1);
    } finally {
      env.DEMO_WORKSPACE_MAX_ACTIVE = previousMaxActive;
    }
  });

  it("atomically caps AI requests for demo tenants without affecting normal tenants", async () => {
    const previousLimit = env.DEMO_WORKSPACE_AI_REQUEST_LIMIT;
    env.DEMO_WORKSPACE_AI_REQUEST_LIMIT = 1;

    try {
      const demo = await request(app).post("/api/auth/demo-session").send({});
      const demoTenantId = demo.body.data.currentTenant.tenantId as string;
      const normalTenant = await prisma.tenant.create({
        data: { name: "Normal Tenant", slug: "normal-ai-budget-tenant" },
      });

      await expect(
        consumePrivateDemoAiRequestBudget(demoTenantId),
      ).resolves.toBeUndefined();
      await expect(
        consumePrivateDemoAiRequestBudget(demoTenantId),
      ).rejects.toMatchObject({
        statusCode: 429,
        code: "DEMO_AI_REQUEST_LIMIT_REACHED",
      });
      await expect(
        consumePrivateDemoAiRequestBudget(normalTenant.id),
      ).resolves.toBeUndefined();

      await expect(
        prisma.demoWorkspace.findUniqueOrThrow({
          where: { tenantId: demoTenantId },
        }),
      ).resolves.toMatchObject({ aiRequestsUsed: 1 });
    } finally {
      env.DEMO_WORKSPACE_AI_REQUEST_LIMIT = previousLimit;
    }
  });
});
