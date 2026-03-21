import { AuditAction, MembershipRole, MembershipStatus } from "@prisma/client";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/modules/auth/auth-password";
import { login } from "../src/modules/auth/auth.service";
import { describeIfDb, resetDatabase } from "./helpers/db";

describeIfDb("membership api integration", () => {
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

  async function seedTenantUser(input: {
    email: string;
    displayName: string;
    role: MembershipRole;
    tenantName: string;
    tenantSlug: string;
  }) {
    const passwordHash = await hashPassword("password123");
    const [tenant, user] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: input.tenantName,
          slug: input.tenantSlug,
        },
      }),
      prisma.user.create({
        data: {
          email: input.email,
          passwordHash,
          displayName: input.displayName,
        },
      }),
    ]);

    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        role: input.role,
        status: MembershipStatus.ACTIVE,
      },
    });

    const session = await login({
      email: user.email,
      password: "password123",
      tenantId: tenant.id,
    });

    return {
      tenant,
      user,
      membership,
      accessToken: session.accessToken,
    };
  }

  it("allows owner and manager to list memberships, but only owner can update", async () => {
    const owner = await seedTenantUser({
      email: "owner@membership-api.test",
      displayName: "Owner API",
      role: MembershipRole.OWNER,
      tenantName: "Membership Tenant",
      tenantSlug: "membership-tenant",
    });

    const passwordHash = await hashPassword("password123");
    const [manager, staff] = await Promise.all([
      prisma.user.create({
        data: {
          email: "manager@membership-api.test",
          passwordHash,
          displayName: "Manager API",
        },
      }),
      prisma.user.create({
        data: {
          email: "staff@membership-api.test",
          passwordHash,
          displayName: "Staff API",
        },
      }),
    ]);

    const [managerMembership, staffMembership] = await Promise.all([
      prisma.membership.create({
        data: {
          userId: manager.id,
          tenantId: owner.tenant.id,
          role: MembershipRole.MANAGER,
          status: MembershipStatus.ACTIVE,
        },
      }),
      prisma.membership.create({
        data: {
          userId: staff.id,
          tenantId: owner.tenant.id,
          role: MembershipRole.STAFF,
          status: MembershipStatus.ACTIVE,
        },
      }),
    ]);

    const managerSession = await login({
      email: manager.email,
      password: "password123",
      tenantId: owner.tenant.id,
    });
    const staffSession = await login({
      email: staff.email,
      password: "password123",
      tenantId: owner.tenant.id,
    });

    const ownerList = await request(app)
      .get("/api/memberships?role=STAFF")
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(ownerList.status).toBe(200);
    expect(ownerList.body.data).toHaveLength(1);
    expect(ownerList.body.data[0]?.email).toBe("staff@membership-api.test");

    const managerList = await request(app)
      .get("/api/memberships?q=Manager")
      .set("Authorization", `Bearer ${managerSession.accessToken}`);
    expect(managerList.status).toBe(200);
    expect(managerList.body.data).toHaveLength(1);
    expect(managerList.body.data[0]?.role).toBe("MANAGER");

    const staffList = await request(app)
      .get("/api/memberships")
      .set("Authorization", `Bearer ${staffSession.accessToken}`);
    expect(staffList.status).toBe(403);

    const managerPatch = await request(app)
      .patch(`/api/memberships/${staffMembership.id}`)
      .set("Authorization", `Bearer ${managerSession.accessToken}`)
      .send({ role: MembershipRole.MANAGER });
    expect(managerPatch.status).toBe(403);

    const ownerPatch = await request(app)
      .patch(`/api/memberships/${staffMembership.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ role: MembershipRole.MANAGER });
    expect(ownerPatch.status).toBe(200);
    expect(ownerPatch.body.data.role).toBe("MANAGER");

    const membershipAudit = await prisma.auditLog.findMany({
      where: {
        tenantId: owner.tenant.id,
        targetId: staffMembership.id,
        action: AuditAction.MEMBERSHIP_UPDATED,
      },
    });
    expect(membershipAudit).toHaveLength(1);

    const disableManager = await request(app)
      .patch(`/api/memberships/${managerMembership.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ status: MembershipStatus.DISABLED });
    expect(disableManager.status).toBe(200);
    expect(disableManager.body.data.status).toBe("DISABLED");

    const disableAudit = await prisma.auditLog.findMany({
      where: {
        tenantId: owner.tenant.id,
        targetId: managerMembership.id,
        action: AuditAction.MEMBERSHIP_UPDATED,
      },
    });
    expect(disableAudit).toHaveLength(1);
  });

  it("protects the last active owner and blocks invited membership mutations", async () => {
    const owner = await seedTenantUser({
      email: "owner@membership-guard.test",
      displayName: "Owner Guard",
      role: MembershipRole.OWNER,
      tenantName: "Owner Guard Tenant",
      tenantSlug: "owner-guard-tenant",
    });

    const passwordHash = await hashPassword("password123");
    const invitedUser = await prisma.user.create({
      data: {
        email: "invited@membership-guard.test",
        passwordHash,
        displayName: "Invited User",
      },
    });
    const invitedMembership = await prisma.membership.create({
      data: {
        userId: invitedUser.id,
        tenantId: owner.tenant.id,
        role: MembershipRole.STAFF,
        status: MembershipStatus.INVITED,
      },
    });

    const disableLastOwner = await request(app)
      .patch(`/api/memberships/${owner.membership.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ status: MembershipStatus.DISABLED });
    expect(disableLastOwner.status).toBe(409);

    const demoteLastOwner = await request(app)
      .patch(`/api/memberships/${owner.membership.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ role: MembershipRole.MANAGER });
    expect(demoteLastOwner.status).toBe(409);

    const invitedPatch = await request(app)
      .patch(`/api/memberships/${invitedMembership.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ status: MembershipStatus.ACTIVE });
    expect(invitedPatch.status).toBe(409);
  });

  it("returns 404 for cross-tenant membership access", async () => {
    const primary = await seedTenantUser({
      email: "owner@primary-membership.test",
      displayName: "Primary Owner",
      role: MembershipRole.OWNER,
      tenantName: "Primary Membership Tenant",
      tenantSlug: "primary-membership-tenant",
    });
    const secondary = await seedTenantUser({
      email: "owner@secondary-membership.test",
      displayName: "Secondary Owner",
      role: MembershipRole.OWNER,
      tenantName: "Secondary Membership Tenant",
      tenantSlug: "secondary-membership-tenant",
    });

    const response = await request(app)
      .patch(`/api/memberships/${primary.membership.id}`)
      .set("Authorization", `Bearer ${secondary.accessToken}`)
      .send({ role: MembershipRole.MANAGER });

    expect(response.status).toBe(404);
  });
});
