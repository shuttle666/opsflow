import type { MembershipRole } from "@prisma/client";

export type AuthContext = {
  userId: string;
  sessionId: string;
  tenantId: string;
  role: MembershipRole;
};

export type RequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

