import {
  AuditAction,
  InvitationStatus,
  MembershipRole,
  MembershipStatus,
} from "@prisma/client";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/modules/auth/auth-password";
import { describeIfDb, resetDatabase } from "./helpers/db";

describeIfDb("auth api integration", () => {
  const app = createApp();

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  it("returns 401 when /auth/me is called without access token", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("supports login and returns 200 for /auth/me with tenant context", async () => {
    const passwordHash = await hashPassword("password123");
    const [tenant, user] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: "API Tenant",
          slug: "api-tenant",
        },
      }),
      prisma.user.create({
        data: {
          email: "api-user@test.dev",
          passwordHash,
          displayName: "API User",
        },
      }),
    ]);

    await prisma.membership.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });

    const loginRes = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: "password123",
      tenantId: tenant.id,
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.accessToken).toBeTruthy();
    expect(loginRes.body.data.refreshToken).toBeUndefined();
    const loginCookies = loginRes.headers["set-cookie"] as string[] | undefined;
    expect(loginCookies?.join(";")).toContain("opsflow_refresh=");
    expect(loginCookies?.join(";")).toContain("HttpOnly");

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.data.accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe(user.email);
    expect(meRes.body.data.currentTenant.tenantId).toBe(tenant.id);

    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", loginCookies ?? [])
      .send({});

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toBeTruthy();
    expect(refreshRes.body.data.refreshToken).toBeUndefined();
    const refreshCookies = refreshRes.headers["set-cookie"] as string[] | undefined;
    expect(refreshCookies?.join(";")).toContain("opsflow_refresh=");
  });

  it("returns 403 for staff role on invitation creation and writes audit log", async () => {
    const passwordHash = await hashPassword("password123");
    const [tenant, staff, invitee] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: "RBAC Tenant",
          slug: "rbac-tenant",
        },
      }),
      prisma.user.create({
        data: {
          email: "staff@test.dev",
          passwordHash,
          displayName: "Staff User",
        },
      }),
      prisma.user.create({
        data: {
          email: "new-user@test.dev",
          passwordHash,
          displayName: "New User",
        },
      }),
    ]);

    await prisma.membership.createMany({
      data: [
        {
          userId: staff.id,
          tenantId: tenant.id,
          role: MembershipRole.STAFF,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: invitee.id,
          tenantId: tenant.id,
          role: MembershipRole.STAFF,
          status: MembershipStatus.DISABLED,
        },
      ],
    });

    const loginRes = await request(app).post("/api/auth/login").send({
      email: staff.email,
      password: "password123",
      tenantId: tenant.id,
    });

    const forbiddenRes = await request(app)
      .post(`/api/tenants/${tenant.id}/invitations`)
      .set("Authorization", `Bearer ${loginRes.body.data.accessToken}`)
      .send({
        email: invitee.email,
        role: "STAFF",
      });

    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.success).toBe(false);

    const forbiddenAudit = await prisma.auditLog.findFirst({
      where: {
        action: AuditAction.RBAC_FORBIDDEN,
        userId: staff.id,
      },
    });

    expect(forbiddenAudit).not.toBeNull();
  });

  it("returns only current user's invitations in /invitations/mine", async () => {
    const passwordHash = await hashPassword("password123");
    const [tenantA, tenantB, owner, invitee] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: "Mine Tenant A",
          slug: "mine-tenant-a",
        },
      }),
      prisma.tenant.create({
        data: {
          name: "Mine Tenant B",
          slug: "mine-tenant-b",
        },
      }),
      prisma.user.create({
        data: {
          email: "mine-owner@test.dev",
          passwordHash,
          displayName: "Mine Owner",
        },
      }),
      prisma.user.create({
        data: {
          email: "mine-invitee@test.dev",
          passwordHash,
          displayName: "Mine Invitee",
        },
      }),
    ]);

    await prisma.membership.createMany({
      data: [
        {
          userId: owner.id,
          tenantId: tenantA.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: invitee.id,
          tenantId: tenantB.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      ],
    });

    const ownerLogin = await request(app).post("/api/auth/login").send({
      email: owner.email,
      password: "password123",
      tenantId: tenantA.id,
    });
    const inviteeLogin = await request(app).post("/api/auth/login").send({
      email: invitee.email,
      password: "password123",
      tenantId: tenantB.id,
    });

    const createdVisible = await request(app)
      .post(`/api/tenants/${tenantA.id}/invitations`)
      .set("Authorization", `Bearer ${ownerLogin.body.data.accessToken}`)
      .send({
        email: invitee.email,
        role: "STAFF",
      });
    expect(createdVisible.status).toBe(201);

    const createdHidden = await request(app)
      .post(`/api/tenants/${tenantA.id}/invitations`)
      .set("Authorization", `Bearer ${ownerLogin.body.data.accessToken}`)
      .send({
        email: "hidden-user@test.dev",
        role: "STAFF",
      });
    expect(createdHidden.status).toBe(201);

    const mineRes = await request(app)
      .get("/api/invitations/mine")
      .set("Authorization", `Bearer ${inviteeLogin.body.data.accessToken}`);

    expect(mineRes.status).toBe(200);
    expect(Array.isArray(mineRes.body.data)).toBe(true);
    expect(mineRes.body.data).toHaveLength(1);
    expect(mineRes.body.data[0].id).toBe(createdVisible.body.data.id);
  });

  it("accepts invitation by id and activates membership", async () => {
    const passwordHash = await hashPassword("password123");
    const [tenantA, tenantB, owner, invitee] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: "Accept Tenant A",
          slug: "accept-tenant-a",
        },
      }),
      prisma.tenant.create({
        data: {
          name: "Accept Tenant B",
          slug: "accept-tenant-b",
        },
      }),
      prisma.user.create({
        data: {
          email: "accept-owner@test.dev",
          passwordHash,
          displayName: "Accept Owner",
        },
      }),
      prisma.user.create({
        data: {
          email: "accept-invitee@test.dev",
          passwordHash,
          displayName: "Accept Invitee",
        },
      }),
    ]);

    await prisma.membership.createMany({
      data: [
        {
          userId: owner.id,
          tenantId: tenantA.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: invitee.id,
          tenantId: tenantB.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      ],
    });

    const ownerLogin = await request(app).post("/api/auth/login").send({
      email: owner.email,
      password: "password123",
      tenantId: tenantA.id,
    });
    const inviteeLogin = await request(app).post("/api/auth/login").send({
      email: invitee.email,
      password: "password123",
      tenantId: tenantB.id,
    });

    const created = await request(app)
      .post(`/api/tenants/${tenantA.id}/invitations`)
      .set("Authorization", `Bearer ${ownerLogin.body.data.accessToken}`)
      .send({
        email: invitee.email,
        role: "MANAGER",
      });
    expect(created.status).toBe(201);

    const accepted = await request(app)
      .post(`/api/invitations/${created.body.data.id}/accept`)
      .set("Authorization", `Bearer ${inviteeLogin.body.data.accessToken}`)
      .send({});

    expect(accepted.status).toBe(200);
    expect(accepted.body.data.tenantId).toBe(tenantA.id);
    expect(accepted.body.data.role).toBe("MANAGER");

    const membership = await prisma.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: invitee.id,
          tenantId: tenantA.id,
        },
      },
    });
    expect(membership?.status).toBe(MembershipStatus.ACTIVE);
    expect(membership?.role).toBe(MembershipRole.MANAGER);

    const invitation = await prisma.tenantInvitation.findUnique({
      where: { id: created.body.data.id },
      select: { status: true },
    });
    expect(invitation?.status).toBe(InvitationStatus.ACCEPTED);
  });

  it("supports owner invitation management list/resend/cancel and enforces pending-only transitions", async () => {
    const passwordHash = await hashPassword("password123");
    const [tenant, owner] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: "Manage Tenant",
          slug: "manage-tenant",
        },
      }),
      prisma.user.create({
        data: {
          email: "manage-owner@test.dev",
          passwordHash,
          displayName: "Manage Owner",
        },
      }),
    ]);

    await prisma.membership.create({
      data: {
        userId: owner.id,
        tenantId: tenant.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });

    const ownerLogin = await request(app).post("/api/auth/login").send({
      email: owner.email,
      password: "password123",
      tenantId: tenant.id,
    });

    const created = await request(app)
      .post(`/api/tenants/${tenant.id}/invitations`)
      .set("Authorization", `Bearer ${ownerLogin.body.data.accessToken}`)
      .send({
        email: "managed-user@test.dev",
        role: "STAFF",
      });
    expect(created.status).toBe(201);

    const listed = await request(app)
      .get(`/api/tenants/${tenant.id}/invitations`)
      .set("Authorization", `Bearer ${ownerLogin.body.data.accessToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.some((item: { id: string }) => item.id === created.body.data.id)).toBe(true);

    const resent = await request(app)
      .post(`/api/tenants/${tenant.id}/invitations/${created.body.data.id}/resend`)
      .set("Authorization", `Bearer ${ownerLogin.body.data.accessToken}`)
      .send({});
    expect(resent.status).toBe(200);
    expect(resent.body.data.status).toBe("PENDING");

    const cancelled = await request(app)
      .post(`/api/tenants/${tenant.id}/invitations/${created.body.data.id}/cancel`)
      .set("Authorization", `Bearer ${ownerLogin.body.data.accessToken}`)
      .send({});
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("CANCELLED");

    const resendAgain = await request(app)
      .post(`/api/tenants/${tenant.id}/invitations/${created.body.data.id}/resend`)
      .set("Authorization", `Bearer ${ownerLogin.body.data.accessToken}`)
      .send({});
    expect(resendAgain.status).toBe(409);
  });
});
