import {
  AuditAction,
  InvitationStatus,
  MembershipRole,
  MembershipStatus,
  TenantStatus,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { AuthError } from "../src/modules/auth/auth-errors";
import { hashPassword } from "../src/modules/auth/auth-password";
import {
  acceptTenantInvitationById,
  cancelTenantInvitation,
  createTenantInvitation,
  listMyInvitations,
  listTenantInvitations,
  login,
  resendTenantInvitation,
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

  it("allows only one concurrent refresh to consume a refresh token", async () => {
    const password = await hashPassword("password123");
    const [tenant, user] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: "Concurrent Tenant",
          slug: "concurrent-tenant",
        },
      }),
      prisma.user.create({
        data: {
          email: "concurrent@test.dev",
          passwordHash: password,
          displayName: "Concurrent User",
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

    const results = await Promise.allSettled([
      refreshSession({ refreshToken: loggedIn.refreshToken }),
      refreshSession({ refreshToken: loggedIn.refreshToken }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
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

    await acceptTenantInvitationById(
      {
        userId: inviteeAuth.userId,
        sessionId: inviteeAuth.sessionId,
        tenantId: inviteeAuth.tenantId,
        role: inviteeAuth.role,
      },
      invitation.id,
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

  it("lists only invitations visible to the current user", async () => {
    const password = await hashPassword("password123");
    const [owner, invitee, outsider] = await Promise.all([
      prisma.user.create({
        data: {
          email: "owner-visible@test.dev",
          passwordHash: password,
          displayName: "Owner Visible",
        },
      }),
      prisma.user.create({
        data: {
          email: "invitee-visible@test.dev",
          passwordHash: password,
          displayName: "Invitee Visible",
        },
      }),
      prisma.user.create({
        data: {
          email: "outsider-visible@test.dev",
          passwordHash: password,
          displayName: "Outsider Visible",
        },
      }),
    ]);

    const [tenantOwner, tenantInvitee] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: "Visible Owner Tenant",
          slug: "visible-owner-tenant",
        },
      }),
      prisma.tenant.create({
        data: {
          name: "Visible Invitee Tenant",
          slug: "visible-invitee-tenant",
        },
      }),
    ]);

    await prisma.membership.createMany({
      data: [
        {
          userId: owner.id,
          tenantId: tenantOwner.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: invitee.id,
          tenantId: tenantInvitee.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: outsider.id,
          tenantId: tenantInvitee.id,
          role: MembershipRole.STAFF,
          status: MembershipStatus.ACTIVE,
        },
      ],
    });

    const ownerLogin = await login({
      email: owner.email,
      password: "password123",
      tenantId: tenantOwner.id,
    });
    const ownerAuth = verifyAccessToken(ownerLogin.accessToken);

    const visibleInvitation = await createTenantInvitation(
      {
        userId: ownerAuth.userId,
        sessionId: ownerAuth.sessionId,
        tenantId: ownerAuth.tenantId,
        role: ownerAuth.role,
      },
      tenantOwner.id,
      {
        email: invitee.email,
        role: MembershipRole.STAFF,
      },
    );

    await createTenantInvitation(
      {
        userId: ownerAuth.userId,
        sessionId: ownerAuth.sessionId,
        tenantId: ownerAuth.tenantId,
        role: ownerAuth.role,
      },
      tenantOwner.id,
      {
        email: "nobody-visible@test.dev",
        role: MembershipRole.STAFF,
      },
    );

    const inviteeLogin = await login({
      email: invitee.email,
      password: "password123",
      tenantId: tenantInvitee.id,
    });
    const inviteeAuth = verifyAccessToken(inviteeLogin.accessToken);

    const myInvitations = await listMyInvitations({
      userId: inviteeAuth.userId,
      sessionId: inviteeAuth.sessionId,
      tenantId: inviteeAuth.tenantId,
      role: inviteeAuth.role,
    });

    expect(myInvitations).toHaveLength(1);
    expect(myInvitations[0]?.id).toBe(visibleInvitation.id);
    expect(myInvitations[0]?.tenantId).toBe(tenantOwner.id);
  });

  it("accept-by-id writes membership, invitation status, and audit", async () => {
    const password = await hashPassword("password123");
    const [owner, invitee] = await Promise.all([
      prisma.user.create({
        data: {
          email: "owner-accept-id@test.dev",
          passwordHash: password,
          displayName: "Owner AcceptById",
        },
      }),
      prisma.user.create({
        data: {
          email: "invitee-accept-id@test.dev",
          passwordHash: password,
          displayName: "Invitee AcceptById",
        },
      }),
    ]);

    const [tenantMain, tenantInvitee] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: "Accept By Id Main",
          slug: "accept-by-id-main",
        },
      }),
      prisma.tenant.create({
        data: {
          name: "Accept By Id Invitee",
          slug: "accept-by-id-invitee",
        },
      }),
    ]);

    await prisma.membership.createMany({
      data: [
        {
          userId: owner.id,
          tenantId: tenantMain.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: invitee.id,
          tenantId: tenantInvitee.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      ],
    });

    const ownerAuth = verifyAccessToken(
      (
        await login({
          email: owner.email,
          password: "password123",
          tenantId: tenantMain.id,
        })
      ).accessToken,
    );

    const invitation = await createTenantInvitation(
      {
        userId: ownerAuth.userId,
        sessionId: ownerAuth.sessionId,
        tenantId: ownerAuth.tenantId,
        role: ownerAuth.role,
      },
      tenantMain.id,
      { email: invitee.email, role: MembershipRole.MANAGER },
    );

    const inviteeAuth = verifyAccessToken(
      (
        await login({
          email: invitee.email,
          password: "password123",
          tenantId: tenantInvitee.id,
        })
      ).accessToken,
    );

    const accepted = await acceptTenantInvitationById(
      {
        userId: inviteeAuth.userId,
        sessionId: inviteeAuth.sessionId,
        tenantId: inviteeAuth.tenantId,
        role: inviteeAuth.role,
      },
      invitation.id,
    );

    expect(accepted.tenantId).toBe(tenantMain.id);
    expect(accepted.role).toBe(MembershipRole.MANAGER);

    const [membership, invitationAfter, audit] = await Promise.all([
      prisma.membership.findUnique({
        where: {
          userId_tenantId: {
            userId: invitee.id,
            tenantId: tenantMain.id,
          },
        },
      }),
      prisma.tenantInvitation.findUnique({
        where: { id: invitation.id },
      }),
      prisma.auditLog.findFirst({
        where: {
          action: AuditAction.TENANT_INVITATION_ACCEPTED,
          targetId: invitation.id,
          userId: invitee.id,
        },
      }),
    ]);

    expect(membership?.status).toBe(MembershipStatus.ACTIVE);
    expect(membership?.role).toBe(MembershipRole.MANAGER);
    expect(invitationAfter?.status).toBe(InvitationStatus.ACCEPTED);
    expect(audit).not.toBeNull();
  });

  it("rejects accept-by-id when invitation is expired, cancelled, mismatched, or tenant inactive", async () => {
    const password = await hashPassword("password123");
    const [owner, invitee] = await Promise.all([
      prisma.user.create({
        data: {
          email: "owner-fail@test.dev",
          passwordHash: password,
          displayName: "Owner Fail",
        },
      }),
      prisma.user.create({
        data: {
          email: "invitee-fail@test.dev",
          passwordHash: password,
          displayName: "Invitee Fail",
        },
      }),
    ]);

    const [tenantMain, tenantInvitee] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: "Failure Main",
          slug: "failure-main",
        },
      }),
      prisma.tenant.create({
        data: {
          name: "Failure Invitee",
          slug: "failure-invitee",
        },
      }),
    ]);

    await prisma.membership.createMany({
      data: [
        {
          userId: owner.id,
          tenantId: tenantMain.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: invitee.id,
          tenantId: tenantInvitee.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      ],
    });

    const ownerAuth = verifyAccessToken(
      (
        await login({
          email: owner.email,
          password: "password123",
          tenantId: tenantMain.id,
        })
      ).accessToken,
    );
    const inviteeAuth = verifyAccessToken(
      (
        await login({
          email: invitee.email,
          password: "password123",
          tenantId: tenantInvitee.id,
        })
      ).accessToken,
    );

    const expiredInvitation = await createTenantInvitation(
      {
        userId: ownerAuth.userId,
        sessionId: ownerAuth.sessionId,
        tenantId: ownerAuth.tenantId,
        role: ownerAuth.role,
      },
      tenantMain.id,
      { email: invitee.email, role: MembershipRole.STAFF },
    );
    await prisma.tenantInvitation.update({
      where: { id: expiredInvitation.id },
      data: {
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    await expect(
      acceptTenantInvitationById(
        {
          userId: inviteeAuth.userId,
          sessionId: inviteeAuth.sessionId,
          tenantId: inviteeAuth.tenantId,
          role: inviteeAuth.role,
        },
        expiredInvitation.id,
      ),
    ).rejects.toMatchObject<AuthError>({
      code: "INVITATION_EXPIRED",
    });

    const cancelledInvitation = await createTenantInvitation(
      {
        userId: ownerAuth.userId,
        sessionId: ownerAuth.sessionId,
        tenantId: ownerAuth.tenantId,
        role: ownerAuth.role,
      },
      tenantMain.id,
      { email: invitee.email, role: MembershipRole.STAFF },
    );
    await cancelTenantInvitation(
      {
        userId: ownerAuth.userId,
        sessionId: ownerAuth.sessionId,
        tenantId: ownerAuth.tenantId,
        role: ownerAuth.role,
      },
      tenantMain.id,
      cancelledInvitation.id,
    );

    await expect(
      acceptTenantInvitationById(
        {
          userId: inviteeAuth.userId,
          sessionId: inviteeAuth.sessionId,
          tenantId: inviteeAuth.tenantId,
          role: inviteeAuth.role,
        },
        cancelledInvitation.id,
      ),
    ).rejects.toMatchObject<AuthError>({
      code: "INVITATION_ALREADY_USED",
    });

    const mismatchInvitation = await createTenantInvitation(
      {
        userId: ownerAuth.userId,
        sessionId: ownerAuth.sessionId,
        tenantId: ownerAuth.tenantId,
        role: ownerAuth.role,
      },
      tenantMain.id,
      { email: "wrong-address@test.dev", role: MembershipRole.STAFF },
    );

    await expect(
      acceptTenantInvitationById(
        {
          userId: inviteeAuth.userId,
          sessionId: inviteeAuth.sessionId,
          tenantId: inviteeAuth.tenantId,
          role: inviteeAuth.role,
        },
        mismatchInvitation.id,
      ),
    ).rejects.toMatchObject<AuthError>({
      code: "INVITATION_USER_MISMATCH",
    });

    const inactiveTenantInvitation = await createTenantInvitation(
      {
        userId: ownerAuth.userId,
        sessionId: ownerAuth.sessionId,
        tenantId: ownerAuth.tenantId,
        role: ownerAuth.role,
      },
      tenantMain.id,
      { email: invitee.email, role: MembershipRole.STAFF },
    );
    await prisma.tenant.update({
      where: { id: tenantMain.id },
      data: {
        status: TenantStatus.DEACTIVATED,
        deletedAt: new Date(),
      },
    });

    await expect(
      acceptTenantInvitationById(
        {
          userId: inviteeAuth.userId,
          sessionId: inviteeAuth.sessionId,
          tenantId: inviteeAuth.tenantId,
          role: inviteeAuth.role,
        },
        inactiveTenantInvitation.id,
      ),
    ).rejects.toMatchObject<AuthError>({
      code: "TENANT_INACTIVE",
    });
  });

  it("allows resend/cancel only while invitation is pending", async () => {
    const password = await hashPassword("password123");
    const [owner, invitee] = await Promise.all([
      prisma.user.create({
        data: {
          email: "owner-pending@test.dev",
          passwordHash: password,
          displayName: "Owner Pending",
        },
      }),
      prisma.user.create({
        data: {
          email: "invitee-pending@test.dev",
          passwordHash: password,
          displayName: "Invitee Pending",
        },
      }),
    ]);

    const [tenantMain, tenantInvitee] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: "Pending Main",
          slug: "pending-main",
        },
      }),
      prisma.tenant.create({
        data: {
          name: "Pending Invitee",
          slug: "pending-invitee",
        },
      }),
    ]);

    await prisma.membership.createMany({
      data: [
        {
          userId: owner.id,
          tenantId: tenantMain.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: invitee.id,
          tenantId: tenantInvitee.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      ],
    });

    const ownerAuth = verifyAccessToken(
      (
        await login({
          email: owner.email,
          password: "password123",
          tenantId: tenantMain.id,
        })
      ).accessToken,
    );

    const invitation = await createTenantInvitation(
      {
        userId: ownerAuth.userId,
        sessionId: ownerAuth.sessionId,
        tenantId: ownerAuth.tenantId,
        role: ownerAuth.role,
      },
      tenantMain.id,
      { email: invitee.email, role: MembershipRole.STAFF },
    );

    const listedBefore = await listTenantInvitations(
      {
        userId: ownerAuth.userId,
        sessionId: ownerAuth.sessionId,
        tenantId: ownerAuth.tenantId,
        role: ownerAuth.role,
      },
      tenantMain.id,
    );
    expect(listedBefore.some((item) => item.id === invitation.id)).toBe(true);

    const resent = await resendTenantInvitation(
      {
        userId: ownerAuth.userId,
        sessionId: ownerAuth.sessionId,
        tenantId: ownerAuth.tenantId,
        role: ownerAuth.role,
      },
      tenantMain.id,
      invitation.id,
    );
    expect(resent.status).toBe(InvitationStatus.PENDING);

    const cancelled = await cancelTenantInvitation(
      {
        userId: ownerAuth.userId,
        sessionId: ownerAuth.sessionId,
        tenantId: ownerAuth.tenantId,
        role: ownerAuth.role,
      },
      tenantMain.id,
      invitation.id,
    );
    expect(cancelled.status).toBe(InvitationStatus.CANCELLED);

    await expect(
      resendTenantInvitation(
        {
          userId: ownerAuth.userId,
          sessionId: ownerAuth.sessionId,
          tenantId: ownerAuth.tenantId,
          role: ownerAuth.role,
        },
        tenantMain.id,
        invitation.id,
      ),
    ).rejects.toMatchObject<AuthError>({
      code: "INVITATION_ALREADY_USED",
    });

    await expect(
      cancelTenantInvitation(
        {
          userId: ownerAuth.userId,
          sessionId: ownerAuth.sessionId,
          tenantId: ownerAuth.tenantId,
          role: ownerAuth.role,
        },
        tenantMain.id,
        invitation.id,
      ),
    ).rejects.toMatchObject<AuthError>({
      code: "INVITATION_ALREADY_USED",
    });
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
