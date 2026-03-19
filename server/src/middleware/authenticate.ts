import type { NextFunction, Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { AuthError } from "../modules/auth/auth-errors";
import { verifyAccessToken } from "../modules/auth/auth-tokens";

function parseBearerToken(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const token = parseBearerToken(req);

    if (!token) {
      throw new AuthError("INVALID_CREDENTIALS", "Missing access token.", 401);
    }

    let payload: JwtPayload | Record<string, unknown>;
    try {
      payload = verifyAccessToken(token) as unknown as JwtPayload;
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

    req.auth = {
      userId: session.userId,
      sessionId: session.id,
      tenantId: session.tenantId,
      role: session.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

