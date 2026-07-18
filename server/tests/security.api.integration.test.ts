import {
  AgentProposalStatus,
  MembershipRole,
  MembershipStatus,
  TenantStatus,
} from "@prisma/client";
import request from "supertest";
import { createApp } from "../src/app";
import { env } from "../src/config/env";
import { prisma } from "../src/lib/prisma";
import {
  createConversation,
  storeDispatchProposal,
  storeTypedProposal,
} from "../src/modules/agent/agent.service";
import { hashPassword } from "../src/modules/auth/auth-password";
import type { AuthContext } from "../src/types/auth";
import { describeIfDb, resetDatabase } from "./helpers/db";

describeIfDb("API and database security boundaries", () => {
  const app = createApp();
  const itIfFakeAi =
    env.AI_DISPATCH_PLANNER_PROVIDER === "fake" ? it : it.skip;

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

  async function seedOwner(suffix: string) {
    const password = "password123";
    const passwordHash = await hashPassword(password);
    const [tenant, user] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: `Security Tenant ${suffix}`,
          slug: `security-tenant-${suffix}`,
        },
      }),
      prisma.user.create({
        data: {
          email: `owner-${suffix}@security.test`,
          passwordHash,
          displayName: `Security Owner ${suffix}`,
        },
      }),
    ]);
    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });
    const login = await request(app).post("/api/auth/login").send({
      email: user.email,
      password,
      tenantId: tenant.id,
    });

    expect(login.status).toBe(200);
    const session = await prisma.authSession.findFirstOrThrow({
      where: {
        userId: user.id,
        tenantId: tenant.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      tenant,
      user,
      membership,
      accessToken: login.body.data.accessToken as string,
      auth: {
        userId: user.id,
        sessionId: session.id,
        tenantId: tenant.id,
        role: MembershipRole.OWNER,
      } satisfies AuthContext,
    };
  }

  it("returns non-disclosing errors when another tenant guesses resource IDs", async () => {
    const [primary, secondary] = await Promise.all([
      seedOwner("primary"),
      seedOwner("secondary"),
    ]);
    const customer = await prisma.customer.create({
      data: {
        tenantId: primary.tenant.id,
        createdById: primary.user.id,
        name: "Private Primary Customer",
      },
    });
    const job = await prisma.job.create({
      data: {
        tenantId: primary.tenant.id,
        customerId: customer.id,
        createdById: primary.user.id,
        title: "Private Primary Job",
        serviceAddress: "1 Private Street, Adelaide SA 5000",
      },
    });
    const conversation = await createConversation(primary.auth);
    const proposal = await storeDispatchProposal(primary.auth, conversation.id, {
      intent: "create_customer",
      customer: {
        status: "new",
        name: "Private AI Customer",
      },
      jobDraft: {
        title: "Customer record only",
      },
      scheduleDraft: {
        timezone: "Australia/Adelaide",
      },
      warnings: [],
      confidence: 1,
    });
    const authorization = `Bearer ${secondary.accessToken}`;

    const probes = await Promise.all([
      request(app)
        .get(`/api/customers/${customer.id}`)
        .set("Authorization", authorization),
      request(app)
        .patch(`/api/customers/${customer.id}`)
        .set("Authorization", authorization)
        .send({ name: "Leaked customer" }),
      request(app)
        .get(`/api/jobs/${job.id}`)
        .set("Authorization", authorization),
      request(app)
        .patch(`/api/jobs/${job.id}`)
        .set("Authorization", authorization)
        .send({
          customerId: customer.id,
          title: "Leaked job",
          serviceAddress: "2 Leaked Street, Adelaide SA 5000",
        }),
      request(app)
        .get(`/api/jobs/${job.id}/history`)
        .set("Authorization", authorization),
      request(app)
        .get(`/api/jobs/${job.id}/evidence`)
        .set("Authorization", authorization),
      request(app)
        .patch(`/api/memberships/${primary.membership.id}`)
        .set("Authorization", authorization)
        .send({ role: MembershipRole.MANAGER }),
      request(app)
        .get(`/api/agent/conversations/${conversation.id}`)
        .set("Authorization", authorization),
      request(app)
        .patch(
          `/api/agent/conversations/${conversation.id}/proposals/${proposal.id}`,
        )
        .set("Authorization", authorization)
        .send({ customerId: customer.id }),
      request(app)
        .post(
          `/api/agent/conversations/${conversation.id}/proposals/${proposal.id}/confirm`,
        )
        .set("Authorization", authorization),
    ]);

    expect(probes.map((response) => response.status)).toEqual(
      Array(probes.length).fill(404),
    );
    for (const response of probes) {
      expect(response.body.success).toBe(false);
    }

    const mismatchedInvitation = await request(app)
      .get(`/api/tenants/${primary.tenant.id}/invitations`)
      .set("Authorization", authorization);
    expect(mismatchedInvitation.status).toBe(403);

    await expect(
      prisma.customer.findUniqueOrThrow({ where: { id: customer.id } }),
    ).resolves.toMatchObject({ name: "Private Primary Customer" });
    await expect(
      prisma.job.findUniqueOrThrow({ where: { id: job.id } }),
    ).resolves.toMatchObject({ title: "Private Primary Job" });
    await expect(
      prisma.agentProposal.findUniqueOrThrow({ where: { id: proposal.id } }),
    ).resolves.toMatchObject({ status: AgentProposalStatus.PENDING });
    await expect(
      prisma.customer.count({
        where: {
          tenantId: secondary.tenant.id,
          name: "Private AI Customer",
        },
      }),
    ).resolves.toBe(0);
  });

  it("revalidates role, membership, and tenant state instead of trusting stale tokens", async () => {
    const owner = await seedOwner("stale-access");
    const authorization = `Bearer ${owner.accessToken}`;

    await prisma.membership.update({
      where: { id: owner.membership.id },
      data: { role: MembershipRole.STAFF },
    });
    const demoted = await request(app)
      .post("/api/customers")
      .set("Authorization", authorization)
      .send({ name: "Must not be created" });
    expect(demoted.status).toBe(403);
    expect(demoted.body.code).toBe("AUTH_FORBIDDEN_ROLE");

    await prisma.membership.update({
      where: { id: owner.membership.id },
      data: { status: MembershipStatus.DISABLED },
    });
    const disabled = await request(app)
      .get("/api/customers")
      .set("Authorization", authorization);
    expect(disabled.status).toBe(403);
    expect(disabled.body.code).toBe("AUTH_MEMBERSHIP_INACTIVE");

    await prisma.membership.update({
      where: { id: owner.membership.id },
      data: {
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });
    await prisma.tenant.update({
      where: { id: owner.tenant.id },
      data: { status: TenantStatus.DEACTIVATED },
    });
    const deactivated = await request(app)
      .get("/api/customers")
      .set("Authorization", authorization);
    expect(deactivated.status).toBe(403);
    expect(deactivated.body.code).toBe("AUTH_TENANT_INACTIVE");

    await expect(
      prisma.customer.count({
        where: { tenantId: owner.tenant.id, name: "Must not be created" },
      }),
    ).resolves.toBe(0);
  });

  it("correlates an authenticated request ID with its structured backend log", async () => {
    const owner = await seedOwner("request-id");
    const requestId = "security-request-id-123";
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    try {
      const response = await request(app)
        .get("/api/customers?page=1&pageSize=10")
        .set("Authorization", `Bearer ${owner.accessToken}`)
        .set("X-Request-Id", requestId);

      expect(response.status).toBe(200);
      expect(response.headers["x-request-id"]).toBe(requestId);

      await vi.waitFor(() => {
        const requestLog = info.mock.calls
          .map(([entry]) => {
            if (typeof entry !== "string") return undefined;
            try {
              return JSON.parse(entry) as Record<string, unknown>;
            } catch {
              return undefined;
            }
          })
          .find(
            (entry) =>
              entry?.type === "http_request" && entry.requestId === requestId,
          );

        expect(requestLog).toMatchObject({
          requestId,
          method: "GET",
          path: "/api/customers?page=1&pageSize=10",
          statusCode: 200,
          userId: owner.user.id,
          tenantId: owner.tenant.id,
        });
      });

      expect(JSON.stringify(info.mock.calls)).not.toContain(owner.accessToken);
    } finally {
      info.mockRestore();
    }
  });

  itIfFakeAi(
    "propagates the HTTP request ID into PII-minimized Tool Invocation records",
    async () => {
      const owner = await seedOwner("tool-request-id");
      await prisma.customer.create({
        data: {
          tenantId: owner.tenant.id,
          createdById: owner.user.id,
          name: "Traceable Security Customer",
        },
      });
      const authorization = `Bearer ${owner.accessToken}`;
      const createConversationResponse = await request(app)
        .post("/api/agent/conversations")
        .set("Authorization", authorization);

      expect(createConversationResponse.status).toBe(201);
      const conversationId = createConversationResponse.body.data.id as string;
      const requestId = "agent-tool-request-id-123";
      const sensitiveValues = {
        customer: "Traceable Security Customer",
        title: "Traceable private repair",
        serviceAddress: "99 Private Lane, Adelaide SA 5000",
      };
      const command = `[opsflow-e2e:create-job] ${JSON.stringify(sensitiveValues)}`;
      const response = await request(app)
        .post(`/api/agent/conversations/${conversationId}/messages`)
        .set("Authorization", authorization)
        .set("X-Request-Id", requestId)
        .send({ content: command, timezone: "Australia/Adelaide" });

      expect(response.status).toBe(200);
      expect(response.headers["x-request-id"]).toBe(requestId);
      expect(response.text).toContain('"type":"proposal"');

      const invocationRecords = await prisma.toolInvocation.findMany({
        where: {
          tenantId: owner.tenant.id,
          userId: owner.user.id,
          conversationId,
          requestId,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      expect(invocationRecords.map((record) => record.toolName)).toEqual([
        "search_customers",
        "propose_create_job",
      ]);
      expect(invocationRecords).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            requestId,
            inputKeys: ["page", "pageSize", "q"],
            outputKeys: ["customers", "pagination"],
          }),
          expect.objectContaining({
            requestId,
            inputKeys: ["customer", "serviceAddress", "title"],
            outputKeys: expect.arrayContaining([
              "approvalUrl",
              "proposal",
              "proposalId",
              "saved",
            ]),
          }),
        ]),
      );

      const persistedMetadata = JSON.stringify(invocationRecords);
      for (const value of Object.values(sensitiveValues)) {
        expect(persistedMetadata).not.toContain(value);
      }
    },
  );

  it("confirms a proposal once under concurrent API requests and replays its receipt", async () => {
    const owner = await seedOwner("idempotency");
    const customer = await prisma.customer.create({
      data: {
        tenantId: owner.tenant.id,
        createdById: owner.user.id,
        name: "Idempotency Customer",
      },
    });
    const conversation = await createConversation(owner.auth);
    const proposal = await storeTypedProposal(owner.auth, conversation.id, {
      type: "CREATE_JOB",
      target: { customerId: customer.id },
      customer: {
        status: "matched",
        matchedCustomerId: customer.id,
        matches: [{ id: customer.id, name: customer.name }],
      },
      jobDraft: {
        title: "Exactly once API job",
        serviceAddress: "10 Grenfell Street, Adelaide SA 5000",
      },
      warnings: [],
      confidence: 1,
    });
    const confirmPath =
      `/api/agent/conversations/${conversation.id}/proposals/${proposal.id}/confirm`;
    const authorization = `Bearer ${owner.accessToken}`;

    const concurrent = await Promise.all([
      request(app).post(confirmPath).set("Authorization", authorization),
      request(app).post(confirmPath).set("Authorization", authorization),
    ]);
    expect(concurrent.some((response) => response.status === 201)).toBe(true);
    expect(concurrent.every((response) => [201, 409].includes(response.status))).toBe(
      true,
    );

    const firstReceipt = concurrent.find((response) => response.status === 201);
    expect(firstReceipt).toBeDefined();
    const replay = await request(app)
      .post(confirmPath)
      .set("Authorization", authorization);

    expect(replay.status).toBe(201);
    expect(replay.body.data).toEqual(firstReceipt?.body.data);
    await expect(
      prisma.job.count({
        where: {
          tenantId: owner.tenant.id,
          title: "Exactly once API job",
        },
      }),
    ).resolves.toBe(1);
  });
});
