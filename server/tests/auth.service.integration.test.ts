import {
  MembershipRole,
  MembershipStatus,
  TenantStatus,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { AuthError } from "../src/modules/auth/auth-errors";
import { hashPassword } from "../src/modules/auth/auth-password";
import {
  acceptTenantInvitation,
  createTenantInvitation,
  login,
  refreshSession,
  switchTenant,
} from "../src/modules/auth/auth.service";
import { verifyAccessToken } from "../src/modules/auth/auth-tokens";
import { describeIfDb, resetDatabase } from "./helpers/db";

describeIfDb("auth service integration", () => {
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

  it("supports login + refresh rotation", async () => {
    const password = await hashPassword("password123");
    const [tenant, user] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: "Alpha Tenant",
          slug: "alpha-tenant",
        },
      }),
      prisma.user.create({
        data: {
          email: "alpha@test.dev",
          passwordHash: password,
          displayName: "Alpha User",
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

    const loggedIn = await login({
      email: user.email,
      password: "password123",
      tenantId: tenant.id,
    });

    const refreshed = await refreshSession({
      refreshToken: loggedIn.refreshToken,
    });

    expect(refreshed.currentTenant.tenantId).toBe(tenant.id);

    await expect(
      refreshSession({
        refreshToken: loggedIn.refreshToken,
      }),
    ).rejects.toMatchObject<AuthError>({
      code: "SESSION_REVOKED",
    });
  });

  it("switches tenant for users with multiple memberships", async () => {
    const password = await hashPassword("password123");
    const user = await prisma.user.create({
      data: {
        email: "multi@test.dev",
        passwordHash: password,
        displayName: "Multi User",
      },
    });

    const [tenantA, tenantB] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: "Tenant A",
          slug: "tenant-a",
        },
      }),
      prisma.tenant.create({
        data: {
          name: "Tenant B",
          slug: "tenant-b",
        },
      }),
    ]);

    await prisma.membership.createMany({
      data: [
        {
          userId: user.id,
          tenantId: tenantA.id,
          role: MembershipRole.MANAGER,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: user.id,
          tenantId: tenantB.id,
          role: MembershipRole.STAFF,
          status: MembershipStatus.ACTIVE,
        },
      ],
    });

    const loggedIn = await login({
      email: user.email,
      password: "password123",
      tenantId: tenantA.id,
    });

    const auth = verifyAccessToken(loggedIn.accessToken);

    const switched = await switchTenant(
      {
        userId: auth.userId,
        sessionId: auth.sessionId,
        tenantId: auth.tenantId,
        role: auth.role,
      },
      { tenantId: tenantB.id },
    );

    const switchedPayload = verifyAccessToken(switched.accessToken);
    expect(switchedPayload.tenantId).toBe(tenantB.id);
    expect(switchedPayload.role).toBe(MembershipRole.STAFF);

    await expect(
      switchTenant(
        {
          userId: auth.userId,
          sessionId: auth.sessionId,
          tenantId: auth.tenantId,
          role: auth.role,
        },
        { tenantId: "70000000-0000-4000-8000-000000000777" },
      ),
    ).rejects.toMatchObject<AuthError>({
      code: "TENANT_NOT_FOUND",
    });
  });

  it("creates invitation and activates membership after accept", async () => {
    const password = await hashPassword("password123");
    const inviter = await prisma.user.create({
      data: {
        email: "owner@test.dev",
        passwordHash: password,
        displayName: "Owner User",
      },
    });

    const invitee = await prisma.user.create({
      data: {
        email: "invitee@test.dev",
        passwordHash: password,
        displayName: "Invitee User",
      },
    });

    const [tenantMain, tenantSecondary] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: "Tenant Main",
          slug: "tenant-main",
        },
      }),
      prisma.tenant.create({
        data: {
          name: "Tenant Secondary",
          slug: "tenant-secondary",
        },
      }),
    ]);

    await prisma.membership.createMany({
      data: [
        {
          userId: inviter.id,
          tenantId: tenantMain.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: invitee.id,
          tenantId: tenantSecondary.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      ],
    });

    const inviterLogin = await login({
      email: inviter.email,
      password: "password123",
      tenantId: tenantMain.id,
    });

    const inviterAuth = verifyAccessToken(inviterLogin.accessToken);

    const invitation = await createTenantInvitation(
      {
        userId: inviterAuth.userId,
        sessionId: inviterAuth.sessionId,
        tenantId: inviterAuth.tenantId,
        role: inviterAuth.role,
      },
      tenantMain.id,
      {
        email: invitee.email,
        role: MembershipRole.STAFF,
      },
    );

    const invitedMembership = await prisma.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: invitee.id,
          tenantId: tenantMain.id,
        },
      },
    });
    expect(invitedMembership?.status).toBe(MembershipStatus.INVITED);

    const inviteeLogin = await login({
      email: invitee.email,
      password: "password123",
      tenantId: tenantSecondary.id,
    });

    const inviteeAuth = verifyAccessToken(inviteeLogin.accessToken);

    await acceptTenantInvitation(
      {
        userId: inviteeAuth.userId,
        sessionId: inviteeAuth.sessionId,
        tenantId: inviteeAuth.tenantId,
        role: inviteeAuth.role,
      },
      {
        token: invitation.token,
      },
    );

    const activatedMembership = await prisma.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: invitee.id,
          tenantId: tenantMain.id,
        },
      },
    });
    expect(activatedMembership?.status).toBe(MembershipStatus.ACTIVE);
  });

  it("blocks login when tenant is deactivated", async () => {
    const password = await hashPassword("password123");
    const user = await prisma.user.create({
      data: {
        email: "inactive-tenant@test.dev",
        passwordHash: password,
        displayName: "Inactive Tenant User",
      },
    });

    const tenant = await prisma.tenant.create({
      data: {
        name: "Inactive Tenant",
        slug: "inactive-tenant",
        status: TenantStatus.DEACTIVATED,
        deletedAt: new Date(),
      },
    });

    await prisma.membership.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });

    await expect(
      login({
        email: user.email,
        password: "password123",
      }),
    ).rejects.toMatchObject<AuthError>({
      code: "MEMBERSHIP_INACTIVE",
    });
  });
});

