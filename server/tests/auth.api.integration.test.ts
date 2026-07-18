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

  it("returns a stable code for invalid credentials", async () => {
    const passwordHash = await hashPassword("password123");
    const [tenant, user] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: "Invalid Login Tenant",
          slug: "invalid-login-tenant",
        },
      }),
      prisma.user.create({
        data: {
          email: "invalid-login@test.dev",
          passwordHash,
          displayName: "Invalid Login User",
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

    const response = await request(app)
      .post("/api/auth/login")
      .set("X-Request-Id", "invalid-login-request")
      .send({
        email: user.email,
        password: "wrong-password",
        tenantId: tenant.id,
      });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      code: "AUTH_INVALID_CREDENTIALS",
      requestId: "invalid-login-request",
      message: "Invalid email or password.",
    });
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

  it("allows an active manager to create a tenant invitation", async () => {
    const passwordHash = await hashPassword("password123");
    const [tenant, manager] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: "Manager Invitation Tenant",
          slug: "manager-invitation-tenant",
        },
      }),
      prisma.user.create({
        data: {
          email: "manager-inviter@test.dev",
          passwordHash,
          displayName: "Manager Inviter",
        },
      }),
    ]);

    await prisma.membership.create({
      data: {
        userId: manager.id,
        tenantId: tenant.id,
        role: MembershipRole.MANAGER,
        status: MembershipStatus.ACTIVE,
      },
    });
    const managerLogin = await request(app).post("/api/auth/login").send({
      email: manager.email,
      password: "password123",
      tenantId: tenant.id,
    });

    const response = await request(app)
      .post(`/api/tenants/${tenant.id}/invitations`)
      .set(
        "Authorization",
        `Bearer ${managerLogin.body.data.accessToken}`,
      )
      .send({
        email: "manager-created-invite@test.dev",
        role: MembershipRole.STAFF,
      });

    expect(response.status).toBe(201);
    await expect(
      prisma.tenantInvitation.findUniqueOrThrow({
        where: { id: response.body.data.id },
      }),
    ).resolves.toMatchObject({
      tenantId: tenant.id,
      invitedById: manager.id,
      role: MembershipRole.STAFF,
      status: InvitationStatus.PENDING,
    });
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

  it("cancels stale invitations so they cannot remove the tenant's final owner", async () => {
    const passwordHash = await hashPassword("password123");
    const [tenant, inviteeTenant, owner, invitee] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: "Stale Invitation Tenant",
          slug: "stale-invitation-tenant",
        },
      }),
      prisma.tenant.create({
        data: {
          name: "Stale Invitation Invitee Tenant",
          slug: "stale-invitation-invitee-tenant",
        },
      }),
      prisma.user.create({
        data: {
          email: "stale-invitation-owner@test.dev",
          passwordHash,
          displayName: "Stale Invitation Owner",
        },
      }),
      prisma.user.create({
        data: {
          email: "stale-invitation-invitee@test.dev",
          passwordHash,
          displayName: "Stale Invitation Invitee",
        },
      }),
    ]);

    const [ownerMembership] = await Promise.all([
      prisma.membership.create({
        data: {
          userId: owner.id,
          tenantId: tenant.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      }),
      prisma.membership.create({
        data: {
          userId: invitee.id,
          tenantId: inviteeTenant.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      }),
    ]);

    const [ownerLogin, inviteeLogin] = await Promise.all([
      request(app).post("/api/auth/login").send({
        email: owner.email,
        password: "password123",
        tenantId: tenant.id,
      }),
      request(app).post("/api/auth/login").send({
        email: invitee.email,
        password: "password123",
        tenantId: inviteeTenant.id,
      }),
    ]);

    const managerInvitation = await request(app)
      .post(`/api/tenants/${tenant.id}/invitations`)
      .set("Authorization", `Bearer ${ownerLogin.body.data.accessToken}`)
      .send({
        email: invitee.email,
        role: "MANAGER",
      });
    expect(managerInvitation.status).toBe(201);

    const staleStaffInvitation = await request(app)
      .post(`/api/tenants/${tenant.id}/invitations`)
      .set("Authorization", `Bearer ${ownerLogin.body.data.accessToken}`)
      .send({
        email: invitee.email,
        role: "STAFF",
      });
    expect(staleStaffInvitation.status).toBe(201);

    const acceptedManagerInvitation = await request(app)
      .post(`/api/invitations/${managerInvitation.body.data.id}/accept`)
      .set("Authorization", `Bearer ${inviteeLogin.body.data.accessToken}`)
      .send({});
    expect(acceptedManagerInvitation.status).toBe(200);
    expect(acceptedManagerInvitation.body.data.role).toBe("MANAGER");

    const staleInvitationAfterAccept = await prisma.tenantInvitation.findUnique({
      where: {
        id: staleStaffInvitation.body.data.id,
      },
      select: {
        status: true,
        cancelledAt: true,
      },
    });
    expect(staleInvitationAfterAccept?.status).toBe(
      InvitationStatus.CANCELLED,
    );
    expect(staleInvitationAfterAccept?.cancelledAt).not.toBeNull();

    const inviteeMembership = await prisma.membership.findUniqueOrThrow({
      where: {
        userId_tenantId: {
          userId: invitee.id,
          tenantId: tenant.id,
        },
      },
      select: {
        id: true,
      },
    });
    const promotedInvitee = await request(app)
      .patch(`/api/memberships/${inviteeMembership.id}`)
      .set("Authorization", `Bearer ${ownerLogin.body.data.accessToken}`)
      .send({ role: "OWNER" });
    expect(promotedInvitee.status).toBe(200);

    const demotedOriginalOwner = await request(app)
      .patch(`/api/memberships/${ownerMembership.id}`)
      .set("Authorization", `Bearer ${ownerLogin.body.data.accessToken}`)
      .send({ role: "STAFF" });
    expect(demotedOriginalOwner.status).toBe(200);

    // Simulate a pending invitation left behind by an older deployment. The
    // active membership check is the final guard even if sibling cancellation
    // did not run for legacy data.
    await prisma.tenantInvitation.update({
      where: {
        id: staleStaffInvitation.body.data.id,
      },
      data: {
        status: InvitationStatus.PENDING,
        cancelledAt: null,
      },
    });

    const staleAcceptAttempt = await request(app)
      .post(`/api/invitations/${staleStaffInvitation.body.data.id}/accept`)
      .set("Authorization", `Bearer ${inviteeLogin.body.data.accessToken}`)
      .send({});
    expect(staleAcceptAttempt.status).toBe(409);
    expect(staleAcceptAttempt.body.code).toBe("AUTH_INVITATION_ALREADY_USED");
    expect(staleAcceptAttempt.body.message).toBe(
      "User is already an active member in this tenant.",
    );

    const [activeOwnerCount, memberships] = await Promise.all([
      prisma.membership.count({
        where: {
          tenantId: tenant.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      }),
      prisma.membership.findMany({
        where: {
          tenantId: tenant.id,
        },
        select: {
          userId: true,
          role: true,
          status: true,
        },
      }),
    ]);

    expect(activeOwnerCount).toBe(1);
    expect(memberships).toEqual(
      expect.arrayContaining([
        {
          userId: owner.id,
          role: MembershipRole.STAFF,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: invitee.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      ]),
    );

    // A legacy pending invitation must not undo an explicit disable either.
    // Restore another active Owner first so the fixture keeps its invariant
    // while directly simulating the old inconsistent data.
    await prisma.$transaction([
      prisma.membership.update({
        where: { id: ownerMembership.id },
        data: { role: MembershipRole.OWNER },
      }),
      prisma.membership.update({
        where: { id: inviteeMembership.id },
        data: { status: MembershipStatus.DISABLED },
      }),
    ]);

    const disabledMemberAcceptAttempt = await request(app)
      .post(`/api/invitations/${staleStaffInvitation.body.data.id}/accept`)
      .set("Authorization", `Bearer ${inviteeLogin.body.data.accessToken}`)
      .send({});
    expect(disabledMemberAcceptAttempt.status).toBe(409);
    expect(disabledMemberAcceptAttempt.body).toMatchObject({
      code: "AUTH_INVITATION_ALREADY_USED",
      message: "User membership is not awaiting an invitation.",
    });
    await expect(
      prisma.membership.findUniqueOrThrow({
        where: { id: inviteeMembership.id },
      }),
    ).resolves.toMatchObject({
      role: MembershipRole.OWNER,
      status: MembershipStatus.DISABLED,
    });
  });

  it("accepts only one concurrent duplicate invitation for a newly registered email", async () => {
    const passwordHash = await hashPassword("password123");
    const [tenant, owner] = await Promise.all([
      prisma.tenant.create({
        data: {
          name: "Concurrent Invitation Tenant",
          slug: "concurrent-invitation-tenant",
        },
      }),
      prisma.user.create({
        data: {
          email: "concurrent-invitation-owner@test.dev",
          passwordHash,
          displayName: "Concurrent Invitation Owner",
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
    const inviteeEmail = "concurrent-new-invitee@test.dev";

    const firstInvitation = await request(app)
      .post(`/api/tenants/${tenant.id}/invitations`)
      .set("Authorization", `Bearer ${ownerLogin.body.data.accessToken}`)
      .send({
        email: inviteeEmail,
        role: "STAFF",
      });
    const secondInvitation = await request(app)
      .post(`/api/tenants/${tenant.id}/invitations`)
      .set("Authorization", `Bearer ${ownerLogin.body.data.accessToken}`)
      .send({
        email: inviteeEmail,
        role: "STAFF",
      });
    expect(firstInvitation.status).toBe(201);
    expect(secondInvitation.status).toBe(201);

    const inviteeRegistration = await request(app)
      .post("/api/auth/register")
      .send({
        email: inviteeEmail,
        password: "password123",
        displayName: "Concurrent New Invitee",
        tenantName: "Concurrent New Invitee Tenant",
      });
    expect(inviteeRegistration.status).toBe(201);
    const inviteeId = inviteeRegistration.body.data.user.id as string;
    const invitationIds = [
      firstInvitation.body.data.id as string,
      secondInvitation.body.data.id as string,
    ];

    const acceptResponses = await Promise.all(
      invitationIds.map((invitationId) =>
        request(app)
          .post(`/api/invitations/${invitationId}/accept`)
          .set(
            "Authorization",
            `Bearer ${inviteeRegistration.body.data.accessToken}`,
          )
          .send({}),
      ),
    );
    expect(acceptResponses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);

    const [membership, invitations, acceptedAuditCount] = await Promise.all([
      prisma.membership.findUnique({
        where: {
          userId_tenantId: {
            userId: inviteeId,
            tenantId: tenant.id,
          },
        },
      }),
      prisma.tenantInvitation.findMany({
        where: {
          id: {
            in: invitationIds,
          },
        },
        select: {
          status: true,
        },
      }),
      prisma.auditLog.count({
        where: {
          tenantId: tenant.id,
          userId: inviteeId,
          action: AuditAction.TENANT_INVITATION_ACCEPTED,
        },
      }),
    ]);

    expect(membership).toMatchObject({
      role: MembershipRole.STAFF,
      status: MembershipStatus.ACTIVE,
    });
    expect(invitations.map((invitation) => invitation.status).sort()).toEqual([
      InvitationStatus.ACCEPTED,
      InvitationStatus.CANCELLED,
    ]);
    expect(acceptedAuditCount).toBe(1);
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
