import type { JwtPayload } from "jsonwebtoken";
import {
  DemoWorkspaceStatus,
  MembershipStatus,
  TenantStatus,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { AuthContext } from "../../types/auth";
import { AuthError } from "./auth-errors";
import { verifyAccessToken } from "./auth-tokens";

export async function revalidateTenantAuthContext(
  auth: AuthContext,
): Promise<AuthContext> {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_tenantId: {
        userId: auth.userId,
        tenantId: auth.tenantId,
      },
    },
    select: {
      role: true,
      status: true,
      tenant: {
        select: {
          status: true,
          deletedAt: true,
          demoWorkspace: {
            select: {
              status: true,
              expiresAt: true,
            },
          },
        },
      },
    },
  });

  if (!membership || membership.status !== MembershipStatus.ACTIVE) {
    throw new AuthError(
      "MEMBERSHIP_INACTIVE",
      "Membership is not active for this tenant.",
      403,
    );
  }

  const demoWorkspace = membership.tenant.demoWorkspace;
  if (
    demoWorkspace &&
    (demoWorkspace.status !== DemoWorkspaceStatus.ACTIVE ||
      demoWorkspace.expiresAt <= new Date())
  ) {
    throw new AuthError(
      "SESSION_EXPIRED",
      "Quick demo workspace has expired.",
      401,
    );
  }

  if (
    membership.tenant.status !== TenantStatus.ACTIVE ||
    membership.tenant.deletedAt
  ) {
    throw new AuthError("TENANT_INACTIVE", "Tenant is inactive.", 403);
  }

  return {
    ...auth,
    role: membership.role,
  };
}

export async function resolveAuthContextFromAccessToken(
  token: string,
): Promise<AuthContext> {
  let payload: JwtPayload;
  try {
    payload = verifyAccessToken(token) as JwtPayload;
  } catch (_error) {
    throw new AuthError("INVALID_CREDENTIALS", "Invalid access token.", 401);
  }

  const parsed = payload as {
    userId?: string;
    sessionId?: string;
    tenantId?: string;
    role?: string;
  };

  if (!parsed.userId || !parsed.sessionId || !parsed.tenantId || !parsed.role) {
    throw new AuthError("INVALID_CREDENTIALS", "Malformed access token.", 401);
  }

  const session = await prisma.authSession.findUnique({
    where: { id: parsed.sessionId },
    select: {
      id: true,
      userId: true,
      tenantId: true,
      role: true,
      revokedAt: true,
      expiresAt: true,
      tenant: {
        select: {
          demoWorkspace: {
            select: {
              status: true,
              expiresAt: true,
            },
          },
        },
      },
    },
  });

  if (!session || session.userId !== parsed.userId) {
    throw new AuthError("SESSION_REVOKED", "Session is not available.", 401);
  }

  if (session.revokedAt) {
    throw new AuthError("SESSION_REVOKED", "Session has been revoked.", 401);
  }

  const demoWorkspace = session.tenant.demoWorkspace;
  const now = new Date();
  if (
    demoWorkspace &&
    (demoWorkspace.status !== DemoWorkspaceStatus.ACTIVE ||
      demoWorkspace.expiresAt <= now)
  ) {
    await prisma.authSession.updateMany({
      where: {
        tenantId: session.tenantId,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });
    throw new AuthError(
      "SESSION_EXPIRED",
      "Quick demo workspace has expired.",
      401,
    );
  }

  if (session.expiresAt <= now) {
    throw new AuthError("SESSION_EXPIRED", "Session has expired.", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    throw new AuthError("INVALID_CREDENTIALS", "User account is inactive.", 401);
  }

  return {
    userId: session.userId,
    sessionId: session.id,
    tenantId: session.tenantId,
    role: session.role,
  };
}
