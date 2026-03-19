import { AuditAction, MembershipRole, MembershipStatus } from "@prisma/client";
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

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.data.accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe(user.email);
    expect(meRes.body.data.currentTenant.tenantId).toBe(tenant.id);
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
});
