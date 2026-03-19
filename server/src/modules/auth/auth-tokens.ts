import { createHash, randomBytes } from "node:crypto";
import type { MembershipRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";

export type AccessTokenPayload = {
  userId: string;
  sessionId: string;
  tenantId: string;
  role: MembershipRole;
};

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.JWT_ACCESS_EXPIRES_IN_MINUTES}m`,
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function generateRefreshToken() {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getRefreshTokenExpiryDate() {
  return new Date(
    Date.now() + env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
  );
}

export function getInvitationExpiryDate() {
  return new Date(
    Date.now() + env.INVITATION_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
  );
}

