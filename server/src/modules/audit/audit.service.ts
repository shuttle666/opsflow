import { AuditAction, type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export type CreateAuditLogInput = {
  action: AuditAction;
  tenantId?: string | null;
  userId?: string | null;
  targetType?: string;
  targetId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function createAuditLog(input: CreateAuditLogInput) {
  return prisma.auditLog.create({
    data: {
      action: input.action,
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null,
      targetType: input.targetType,
      targetId: input.targetId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: input.metadata,
    },
  });
}

export function createAuditLogSafe(input: CreateAuditLogInput) {
  void createAuditLog(input).catch((error) => {
    console.error("Failed to write audit log.", error);
  });
}

