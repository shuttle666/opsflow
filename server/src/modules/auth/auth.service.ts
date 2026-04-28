import {
  AuditAction,
  InvitationStatus,
  MembershipRole,
  MembershipStatus,
  TenantStatus,
  type Prisma,
} from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import type { AuthContext, RequestMetadata } from "../../types/auth";
import { ApiError } from "../../utils/api-error";
import { AuthError } from "./auth-errors";
import { hashPassword, verifyPassword } from "./auth-password";
import {
  generateRefreshToken,
  getInvitationExpiryDate,
  getRefreshTokenExpiryDate,
  hashRefreshToken,
  signAccessToken,
} from "./auth-tokens";
import type {
  AcceptInvitationInput,
  CreateInvitationInput,
  LoginInput,
  LogoutInput,
  RefreshInput,
  RegisterInput,
  SwitchTenantInput,
} from "./auth-schemas";

type ActiveMembership = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: MembershipRole;
};

type AuthResult = {
  accessToken: string;
  refreshToken: string;
  expiresInMinutes: number;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  currentTenant: ActiveMembership;
  availableTenants: ActiveMembership[];
};

type MyInvitationItem = {
  id: string;
  tenantId: string;
  tenantName: string;
  role: MembershipRole;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
};

type TenantInvitationItem = {
  id: string;
  email: string;
  role: MembershipRole;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: {
    id: string;
    email: string;
    displayName: string;
  };
};

type TenantInvitationMutationResult = {
  id: string;
  status: InvitationStatus;
  expiresAt: Date;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildTenantSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function ensureUniqueTenantSlug(tx: Prisma.TransactionClient, base: string) {
  const sanitizedBase = base || "workspace";

  for (let suffix = 0; suffix < 200; suffix += 1) {
    const candidate = suffix === 0 ? sanitizedBase : `${sanitizedBase}-${suffix}`;
    const exists = await tx.tenant.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!exists) {
      return candidate;
    }
  }

  throw new ApiError(500, "Unable to generate a unique tenant slug.");
}

async function listActiveMemberships(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: {
      userId,
      status: MembershipStatus.ACTIVE,
      tenant: {
        status: TenantStatus.ACTIVE,
        deletedAt: null,
      },
    },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return memberships.map((membership) => ({
    tenantId: membership.tenant.id,
    tenantName: membership.tenant.name,
    tenantSlug: membership.tenant.slug,
    role: membership.role,
  }));
}

function pickTenantMembership(
  memberships: ActiveMembership[],
  tenantId?: string,
) {
  if (memberships.length === 0) {
    throw new AuthError(
      "MEMBERSHIP_INACTIVE",
      "No active tenant membership found for this account.",
      403,
    );
  }

  if (!tenantId) {
    return memberships[0];
  }

  const selected = memberships.find((membership) => membership.tenantId === tenantId);

  if (!selected) {
    throw new AuthError(
      "TENANT_NOT_FOUND",
      "Requested tenant is not available for this account.",
      403,
      { tenantId },
    );
  }

  return selected;
}

async function expirePendingInvitations(where: Prisma.TenantInvitationWhereInput) {
  await prisma.tenantInvitation.updateMany({
    where: {
      ...where,
      status: InvitationStatus.PENDING,
      expiresAt: {
        lte: new Date(),
      },
    },
    data: {
      status: InvitationStatus.EXPIRED,
    },
  });
}

async function getActiveUserOrThrow(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    throw new AuthError("INVALID_CREDENTIALS", "User account is inactive.", 401);
  }

  return user;
}

async function ensureInvitationAcceptable(input: {
  invitation: {
    id: string;
    tenantId: string;
    role: MembershipRole;
    email: string;
    status: InvitationStatus;
    expiresAt: Date;
    tenant: {
      status: TenantStatus;
      deletedAt: Date | null;
    };
  };
  userEmail: string;
}) {
  const { invitation, userEmail } = input;

  if (invitation.status !== InvitationStatus.PENDING) {
    throw new AuthError(
      "INVITATION_ALREADY_USED",
      "Invitation is no longer pending.",
      409,
    );
  }

  if (invitation.expiresAt <= new Date()) {
    await prisma.tenantInvitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.EXPIRED,
      },
    });
    throw new AuthError("INVITATION_EXPIRED", "Invitation has expired.", 409);
  }

  if (
    invitation.tenant.status !== TenantStatus.ACTIVE ||
    invitation.tenant.deletedAt
  ) {
    throw new AuthError("TENANT_INACTIVE", "Tenant is inactive.", 403);
  }

  if (normalizeEmail(userEmail) !== normalizeEmail(invitation.email)) {
    throw new AuthError(
      "INVITATION_USER_MISMATCH",
      "Invitation email does not match the signed-in user.",
      403,
    );
  }
}

async function acceptInvitationTransaction(input: {
  invitationId: string;
  tenantId: string;
  role: MembershipRole;
  userId: string;
  metadata?: RequestMetadata;
}) {
  await prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: input.userId,
          tenantId: input.tenantId,
        },
      },
      select: {
        id: true,
      },
    });

    if (membership) {
      await tx.membership.update({
        where: { id: membership.id },
        data: {
          role: input.role,
          status: MembershipStatus.ACTIVE,
        },
      });
    } else {
      await tx.membership.create({
        data: {
          userId: input.userId,
          tenantId: input.tenantId,
          role: input.role,
          status: MembershipStatus.ACTIVE,
        },
      });
    }

    await tx.tenantInvitation.update({
      where: { id: input.invitationId },
      data: {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
        invitedUserId: input.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        action: AuditAction.TENANT_INVITATION_ACCEPTED,
        tenantId: input.tenantId,
        userId: input.userId,
        targetType: "tenant_invitation",
        targetId: input.invitationId,
        ipAddress: input.metadata?.ipAddress,
        userAgent: input.metadata?.userAgent,
      },
    });
  });
}

async function createSessionAndTokens(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    tenantId: string;
    role: MembershipRole;
    metadata?: RequestMetadata;
  },
) {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = getRefreshTokenExpiryDate();

  const session = await tx.authSession.create({
    data: {
      userId: input.userId,
      tenantId: input.tenantId,
      role: input.role,
      refreshTokenHash,
      expiresAt,
      ipAddress: input.metadata?.ipAddress,
      userAgent: input.metadata?.userAgent,
    },
  });

  const activeSessions = await tx.authSession.findMany({
    where: {
      userId: input.userId,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  const overflowCount = Math.max(0, activeSessions.length - env.AUTH_SESSION_LIMIT);

  if (overflowCount > 0) {
    const staleIds = activeSessions.slice(0, overflowCount).map((item) => item.id);
    await tx.authSession.updateMany({
      where: { id: { in: staleIds } },
      data: { revokedAt: new Date() },
    });
  }

  const accessToken = signAccessToken({
    userId: input.userId,
    sessionId: session.id,
    tenantId: input.tenantId,
    role: input.role,
  });

  return {
    sessionId: session.id,
    accessToken,
    refreshToken,
  };
}

export async function register(input: RegisterInput, metadata?: RequestMetadata) {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const tenantName = input.tenantName?.trim() || `${input.displayName}'s Workspace`;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new ApiError(409, "Email is already registered.");
    }

    const slug = await ensureUniqueTenantSlug(tx, buildTenantSlug(tenantName));

    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        displayName: input.displayName.trim(),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
      },
    });

    const tenant = await tx.tenant.create({
      data: {
        name: tenantName,
        slug,
        status: TenantStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    await tx.membership.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });

    const issued = await createSessionAndTokens(tx, {
      userId: user.id,
      tenantId: tenant.id,
      role: MembershipRole.OWNER,
      metadata,
    });

    await tx.auditLog.create({
      data: {
        action: AuditAction.AUTH_REGISTER,
        tenantId: tenant.id,
        userId: user.id,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        metadata: {
          tenantName,
        },
      },
    });

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      expiresInMinutes: env.JWT_ACCESS_EXPIRES_IN_MINUTES,
      user,
      currentTenant: {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        role: MembershipRole.OWNER,
      },
      availableTenants: [
        {
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantSlug: tenant.slug,
          role: MembershipRole.OWNER,
        },
      ],
    } satisfies AuthResult;
  });
}

export async function login(input: LoginInput, metadata?: RequestMetadata) {
  const email = normalizeEmail(input.email);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      displayName: true,
      passwordHash: true,
      isActive: true,
    },
  });

  const validPassword = user
    ? await verifyPassword(input.password, user.passwordHash)
    : false;

  if (!user || !validPassword || !user.isActive) {
    await prisma.auditLog.create({
      data: {
        action: AuditAction.AUTH_LOGIN_FAILED,
        userId: user?.id,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        metadata: {
          email,
        },
      },
    });

    throw new AuthError(
      "INVALID_CREDENTIALS",
      "Invalid email or password.",
      401,
    );
  }

  const memberships = await listActiveMemberships(user.id);
  const selectedMembership = pickTenantMembership(memberships, input.tenantId);

  const issued = await prisma.$transaction(async (tx) => {
    const created = await createSessionAndTokens(tx, {
      userId: user.id,
      tenantId: selectedMembership.tenantId,
      role: selectedMembership.role,
      metadata,
    });

    await tx.auditLog.create({
      data: {
        action: AuditAction.AUTH_LOGIN,
        tenantId: selectedMembership.tenantId,
        userId: user.id,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      },
    });

    return created;
  });

  return {
    accessToken: issued.accessToken,
    refreshToken: issued.refreshToken,
    expiresInMinutes: env.JWT_ACCESS_EXPIRES_IN_MINUTES,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    currentTenant: selectedMembership,
    availableTenants: memberships,
  } satisfies AuthResult;
}

export async function refreshSession(input: RefreshInput, metadata?: RequestMetadata) {
  if (!input.refreshToken) {
    throw new AuthError("INVALID_CREDENTIALS", "Refresh token is missing.", 401);
  }

  const tokenHash = hashRefreshToken(input.refreshToken);

  const session = await prisma.authSession.findUnique({
    where: { refreshTokenHash: tokenHash },
    select: {
      id: true,
      userId: true,
      tenantId: true,
      role: true,
      revokedAt: true,
      expiresAt: true,
    },
  });

  if (!session) {
    throw new AuthError("SESSION_REVOKED", "Invalid refresh token.", 401);
  }

  if (session.revokedAt) {
    throw new AuthError("SESSION_REVOKED", "Refresh session has been revoked.", 401);
  }

  if (session.expiresAt <= new Date()) {
    await prisma.authSession.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
      },
    });
    throw new AuthError("SESSION_EXPIRED", "Refresh session has expired.", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    throw new AuthError("INVALID_CREDENTIALS", "User account is inactive.", 401);
  }

  const memberships = await listActiveMemberships(user.id);
  const currentTenant = memberships.find(
    (membership) => membership.tenantId === session.tenantId,
  );

  if (!currentTenant) {
    throw new AuthError(
      "MEMBERSHIP_INACTIVE",
      "Current tenant membership is not active.",
      403,
    );
  }

  const issued = await prisma.$transaction(async (tx) => {
    const consumed = await tx.authSession.updateMany({
      where: {
        id: session.id,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (consumed.count !== 1) {
      throw new AuthError(
        "SESSION_REVOKED",
        "Refresh session has already been used.",
        401,
      );
    }

    const created = await createSessionAndTokens(tx, {
      userId: session.userId,
      tenantId: session.tenantId,
      role: currentTenant.role,
      metadata,
    });

    await tx.authSession.update({
      where: { id: session.id },
      data: {
        replacedBySessionId: created.sessionId,
      },
    });

    await tx.auditLog.create({
      data: {
        action: AuditAction.AUTH_REFRESH,
        tenantId: session.tenantId,
        userId: session.userId,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      },
    });

    return created;
  });

  return {
    accessToken: issued.accessToken,
    refreshToken: issued.refreshToken,
    expiresInMinutes: env.JWT_ACCESS_EXPIRES_IN_MINUTES,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    currentTenant,
    availableTenants: memberships,
  } satisfies AuthResult;
}

export async function logout(
  auth: AuthContext,
  input: LogoutInput,
  metadata?: RequestMetadata,
) {
  await prisma.$transaction(async (tx) => {
    if (input.allDevices) {
      await tx.authSession.updateMany({
        where: {
          userId: auth.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    } else {
      await tx.authSession.updateMany({
        where: {
          id: auth.sessionId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    await tx.auditLog.create({
      data: {
        action: AuditAction.AUTH_LOGOUT,
        tenantId: auth.tenantId,
        userId: auth.userId,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        metadata: {
          allDevices: input.allDevices,
        },
      },
    });
  });
}

export async function getAuthMe(auth: AuthContext) {
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    throw new AuthError("INVALID_CREDENTIALS", "User account is inactive.", 401);
  }

  const memberships = await listActiveMemberships(auth.userId);
  const currentTenant = pickTenantMembership(memberships, auth.tenantId);

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    currentTenant,
    availableTenants: memberships,
  };
}

export async function switchTenant(
  auth: AuthContext,
  input: SwitchTenantInput,
  metadata?: RequestMetadata,
) {
  const memberships = await listActiveMemberships(auth.userId);
  const targetMembership = pickTenantMembership(memberships, input.tenantId);

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      email: true,
      displayName: true,
    },
  });

  if (!user) {
    throw new AuthError("INVALID_CREDENTIALS", "User account not found.", 401);
  }

  const issued = await prisma.$transaction(async (tx) => {
    await tx.authSession.updateMany({
      where: {
        id: auth.sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    const created = await createSessionAndTokens(tx, {
      userId: auth.userId,
      tenantId: targetMembership.tenantId,
      role: targetMembership.role,
      metadata,
    });

    await tx.auditLog.create({
      data: {
        action: AuditAction.AUTH_SWITCH_TENANT,
        tenantId: targetMembership.tenantId,
        userId: auth.userId,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      },
    });

    return created;
  });

  return {
    accessToken: issued.accessToken,
    refreshToken: issued.refreshToken,
    expiresInMinutes: env.JWT_ACCESS_EXPIRES_IN_MINUTES,
    user,
    currentTenant: targetMembership,
    availableTenants: memberships,
  } satisfies AuthResult;
}

export async function createTenantInvitation(
  auth: AuthContext,
  tenantId: string,
  input: CreateInvitationInput,
  metadata?: RequestMetadata,
) {
  if (auth.tenantId !== tenantId) {
    throw new AuthError(
      "TENANT_NOT_FOUND",
      "Cross-tenant invitation requests are not allowed.",
      403,
    );
  }

  const email = normalizeEmail(input.email);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      status: true,
      deletedAt: true,
    },
  });

  if (!tenant || tenant.status !== TenantStatus.ACTIVE || tenant.deletedAt) {
    throw new AuthError("TENANT_INACTIVE", "Tenant is inactive.", 403);
  }

  const invitedUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
    },
  });

  const existingMembership = invitedUser
    ? await prisma.membership.findUnique({
        where: {
          userId_tenantId: {
            userId: invitedUser.id,
            tenantId,
          },
        },
        select: {
          id: true,
          status: true,
        },
      })
    : null;

  if (existingMembership?.status === MembershipStatus.ACTIVE) {
    throw new ApiError(409, "User is already an active member in this tenant.");
  }

  const tokenHash = hashRefreshToken(generateRefreshToken());
  const expiresAt = getInvitationExpiryDate();

  const invitation = await prisma.$transaction(async (tx) => {
    if (invitedUser) {
      if (existingMembership) {
        await tx.membership.update({
          where: {
            id: existingMembership.id,
          },
          data: {
            role: input.role,
            status: MembershipStatus.INVITED,
          },
        });
      } else {
        await tx.membership.create({
          data: {
            userId: invitedUser.id,
            tenantId,
            role: input.role,
            status: MembershipStatus.INVITED,
          },
        });
      }
    }

    const createdInvitation = await tx.tenantInvitation.create({
      data: {
        tenantId,
        invitedById: auth.userId,
        invitedUserId: invitedUser?.id,
        email,
        role: input.role,
        tokenHash,
        status: InvitationStatus.PENDING,
        expiresAt,
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        role: true,
        expiresAt: true,
      },
    });

    await tx.auditLog.create({
      data: {
        action: AuditAction.TENANT_INVITATION_CREATED,
        tenantId,
        userId: auth.userId,
        targetType: "tenant_invitation",
        targetId: createdInvitation.id,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        metadata: {
          invitedEmail: email,
          role: input.role,
        },
      },
    });

    return createdInvitation;
  });

  return invitation;
}

export async function listMyInvitations(auth: AuthContext) {
  const user = await getActiveUserOrThrow(auth.userId);
  const normalizedEmail = normalizeEmail(user.email);
  const inviteVisibilityWhere: Prisma.TenantInvitationWhereInput = {
    OR: [{ invitedUserId: user.id }, { email: normalizedEmail }],
  };

  await expirePendingInvitations(inviteVisibilityWhere);

  const invitations = await prisma.tenantInvitation.findMany({
    where: {
      ...inviteVisibilityWhere,
      status: InvitationStatus.PENDING,
    },
    select: {
      id: true,
      tenantId: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      tenant: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
  });

  return invitations.map((invitation) => ({
    id: invitation.id,
    tenantId: invitation.tenantId,
    tenantName: invitation.tenant.name,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  })) satisfies MyInvitationItem[];
}

export async function listTenantInvitations(
  auth: AuthContext,
  tenantId: string,
  status?: InvitationStatus,
) {
  if (auth.tenantId !== tenantId) {
    throw new AuthError(
      "TENANT_NOT_FOUND",
      "Cross-tenant invitation requests are not allowed.",
      403,
    );
  }

  await expirePendingInvitations({ tenantId });

  const invitations = await prisma.tenantInvitation.findMany({
    where: {
      tenantId,
      ...(status ? { status } : {}),
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      invitedBy: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return invitations.map((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    invitedBy: {
      id: invitation.invitedBy.id,
      email: invitation.invitedBy.email,
      displayName: invitation.invitedBy.displayName,
    },
  })) satisfies TenantInvitationItem[];
}

export async function acceptTenantInvitationById(
  auth: AuthContext,
  invitationId: string,
  metadata?: RequestMetadata,
) {
  const user = await getActiveUserOrThrow(auth.userId);

  const invitation = await prisma.tenantInvitation.findUnique({
    where: { id: invitationId },
    select: {
      id: true,
      tenantId: true,
      role: true,
      email: true,
      status: true,
      expiresAt: true,
      tenant: {
        select: {
          status: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!invitation) {
    throw new AuthError("INVITATION_NOT_FOUND", "Invitation not found.", 404);
  }

  await ensureInvitationAcceptable({
    invitation,
    userEmail: user.email,
  });

  await acceptInvitationTransaction({
    invitationId: invitation.id,
    tenantId: invitation.tenantId,
    role: invitation.role,
    userId: user.id,
    metadata,
  });

  return {
    tenantId: invitation.tenantId,
    role: invitation.role,
  };
}

export async function resendTenantInvitation(
  auth: AuthContext,
  tenantId: string,
  invitationId: string,
  metadata?: RequestMetadata,
) {
  if (auth.tenantId !== tenantId) {
    throw new AuthError(
      "TENANT_NOT_FOUND",
      "Cross-tenant invitation requests are not allowed.",
      403,
    );
  }

  await expirePendingInvitations({ id: invitationId, tenantId });

  const invitation = await prisma.tenantInvitation.findFirst({
    where: {
      id: invitationId,
      tenantId,
    },
    select: {
      id: true,
      status: true,
      expiresAt: true,
    },
  });

  if (!invitation) {
    throw new AuthError("INVITATION_NOT_FOUND", "Invitation not found.", 404);
  }

  if (invitation.status !== InvitationStatus.PENDING) {
    throw new AuthError(
      "INVITATION_ALREADY_USED",
      "Only pending invitations can be resent.",
      409,
    );
  }

  const refreshedExpiry = getInvitationExpiryDate();

  await prisma.$transaction(async (tx) => {
    await tx.tenantInvitation.update({
      where: { id: invitation.id },
      data: {
        tokenHash: hashRefreshToken(generateRefreshToken()),
        expiresAt: refreshedExpiry,
      },
    });

    await tx.auditLog.create({
      data: {
        action: AuditAction.TENANT_INVITATION_CREATED,
        tenantId,
        userId: auth.userId,
        targetType: "tenant_invitation",
        targetId: invitation.id,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        metadata: {
          operation: "resend",
        },
      },
    });
  });

  return {
    id: invitation.id,
    status: InvitationStatus.PENDING,
    expiresAt: refreshedExpiry,
  } satisfies TenantInvitationMutationResult;
}

export async function cancelTenantInvitation(
  auth: AuthContext,
  tenantId: string,
  invitationId: string,
  metadata?: RequestMetadata,
) {
  if (auth.tenantId !== tenantId) {
    throw new AuthError(
      "TENANT_NOT_FOUND",
      "Cross-tenant invitation requests are not allowed.",
      403,
    );
  }

  await expirePendingInvitations({ id: invitationId, tenantId });

  const invitation = await prisma.tenantInvitation.findFirst({
    where: {
      id: invitationId,
      tenantId,
    },
    select: {
      id: true,
      status: true,
      expiresAt: true,
    },
  });

  if (!invitation) {
    throw new AuthError("INVITATION_NOT_FOUND", "Invitation not found.", 404);
  }

  if (invitation.status !== InvitationStatus.PENDING) {
    throw new AuthError(
      "INVITATION_ALREADY_USED",
      "Only pending invitations can be cancelled.",
      409,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.tenantInvitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        action: AuditAction.TENANT_INVITATION_CREATED,
        tenantId,
        userId: auth.userId,
        targetType: "tenant_invitation",
        targetId: invitation.id,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        metadata: {
          operation: "cancel",
        },
      },
    });
  });

  return {
    id: invitation.id,
    status: InvitationStatus.CANCELLED,
    expiresAt: invitation.expiresAt,
  } satisfies TenantInvitationMutationResult;
}

export async function acceptTenantInvitation(
  auth: AuthContext,
  input: AcceptInvitationInput,
  metadata?: RequestMetadata,
) {
  const tokenHash = hashRefreshToken(input.token);
  const user = await getActiveUserOrThrow(auth.userId);

  const invitation = await prisma.tenantInvitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      tenantId: true,
      role: true,
      email: true,
      status: true,
      expiresAt: true,
      tenant: {
        select: {
          status: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!invitation) {
    throw new AuthError("INVITATION_NOT_FOUND", "Invitation not found.", 404);
  }

  await ensureInvitationAcceptable({
    invitation,
    userEmail: user.email,
  });

  await acceptInvitationTransaction({
    invitationId: invitation.id,
    tenantId: invitation.tenantId,
    role: invitation.role,
    userId: user.id,
    metadata,
  });

  return {
    tenantId: invitation.tenantId,
    role: invitation.role,
  };
}
