import type { JwtPayload } from "jsonwebtoken";
import { prisma } from "../../lib/prisma";
import type { AuthContext } from "../../types/auth";
import { AuthError } from "./auth-errors";
import { verifyAccessToken } from "./auth-tokens";

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
    },
  });

  if (!session || session.userId !== parsed.userId) {
    throw new AuthError("SESSION_REVOKED", "Session is not available.", 401);
  }

  if (session.revokedAt) {
    throw new AuthError("SESSION_REVOKED", "Session has been revoked.", 401);
  }

  if (session.expiresAt <= new Date()) {
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
