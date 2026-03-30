import { AuditAction, type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { AuthContext } from "../../types/auth";
import type { ActivityListQueryInput } from "./audit-schemas";

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

export type ActivityFeedItem = {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  tone: "brand" | "success" | "warning" | "neutral";
  targetType?: string;
  targetId?: string;
};

type ActivityFeedResult = {
  items: ActivityFeedItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

function getActorName(actor?: { displayName: string; email: string } | null) {
  if (!actor) {
    return "System";
  }

  return actor.displayName || actor.email;
}

function mapAuditToFeedItem(log: {
  id: string;
  action: AuditAction;
  targetType: string | null;
  targetId: string | null;
  createdAt: Date;
  metadata: Prisma.JsonValue | null;
  user: {
    displayName: string;
    email: string;
  } | null;
}): ActivityFeedItem {
  const metadata = (log.metadata ?? {}) as Record<string, unknown>;
  const actor = getActorName(log.user);

  switch (log.action) {
    case AuditAction.JOB_STATUS_TRANSITION: {
      const fromStatus = typeof metadata.fromStatus === "string" ? metadata.fromStatus : "UNKNOWN";
      const toStatus = typeof metadata.toStatus === "string" ? metadata.toStatus : "UNKNOWN";
      const reason = typeof metadata.reason === "string" ? metadata.reason : "";
      return {
        id: log.id,
        title: `Status moved to ${toStatus}`,
        description: reason
          ? `${actor} changed a job from ${fromStatus} to ${toStatus}. Note: ${reason}`
          : `${actor} changed a job from ${fromStatus} to ${toStatus}.`,
        timestamp: log.createdAt,
        tone:
          toStatus === "COMPLETED"
            ? "success"
            : toStatus === "CANCELLED"
              ? "warning"
              : "brand",
        ...(log.targetType ? { targetType: log.targetType } : {}),
        ...(log.targetId ? { targetId: log.targetId } : {}),
      };
    }
    case AuditAction.JOB_ASSIGNED:
      return {
        id: log.id,
        title: "Job assigned",
        description: `${actor} assigned ${(metadata.assigneeName as string | undefined) ?? "a staff member"} to ${(metadata.jobTitle as string | undefined) ?? "a job"}.`,
        timestamp: log.createdAt,
        tone: "brand",
        ...(log.targetType ? { targetType: log.targetType } : {}),
        ...(log.targetId ? { targetId: log.targetId } : {}),
      };
    case AuditAction.JOB_UNASSIGNED:
      return {
        id: log.id,
        title: "Job unassigned",
        description: `${actor} removed ${(metadata.assigneeName as string | undefined) ?? "the assignee"} from ${(metadata.jobTitle as string | undefined) ?? "a job"}.`,
        timestamp: log.createdAt,
        tone: "brand",
        ...(log.targetType ? { targetType: log.targetType } : {}),
        ...(log.targetId ? { targetId: log.targetId } : {}),
      };
    case AuditAction.MEMBERSHIP_UPDATED:
      return {
        id: log.id,
        title: "Team member updated",
        description: `${actor} updated ${(metadata.memberEmail as string | undefined) ?? "a member"} role/status in this tenant.`,
        timestamp: log.createdAt,
        tone: "brand",
        ...(log.targetType ? { targetType: log.targetType } : {}),
        ...(log.targetId ? { targetId: log.targetId } : {}),
      };
    case AuditAction.JOB_EVIDENCE_UPLOADED:
      return {
        id: log.id,
        title: "Evidence added",
        description: `${actor} uploaded ${(metadata.fileName as string | undefined) ?? "a file"} to ${(metadata.jobTitle as string | undefined) ?? "a job"}.`,
        timestamp: log.createdAt,
        tone: "brand",
        ...(log.targetType ? { targetType: log.targetType } : {}),
        ...(log.targetId ? { targetId: log.targetId } : {}),
      };
    case AuditAction.JOB_EVIDENCE_DELETED:
      return {
        id: log.id,
        title: "Evidence removed",
        description: `${actor} removed ${(metadata.fileName as string | undefined) ?? "a file"} from ${(metadata.jobTitle as string | undefined) ?? "a job"}.`,
        timestamp: log.createdAt,
        tone: "warning",
        ...(log.targetType ? { targetType: log.targetType } : {}),
        ...(log.targetId ? { targetId: log.targetId } : {}),
      };
    case AuditAction.TENANT_INVITATION_CREATED:
      return {
        id: log.id,
        title: "Invitation created",
        description: `${actor} invited ${(metadata.invitedEmail as string | undefined) ?? "a new member"} to the tenant.`,
        timestamp: log.createdAt,
        tone: "brand",
        ...(log.targetType ? { targetType: log.targetType } : {}),
        ...(log.targetId ? { targetId: log.targetId } : {}),
      };
    case AuditAction.TENANT_INVITATION_ACCEPTED:
      return {
        id: log.id,
        title: "Invitation accepted",
        description: `${actor} accepted a tenant invitation.`,
        timestamp: log.createdAt,
        tone: "success",
        ...(log.targetType ? { targetType: log.targetType } : {}),
        ...(log.targetId ? { targetId: log.targetId } : {}),
      };
    case AuditAction.RBAC_FORBIDDEN:
      return {
        id: log.id,
        title: "Permission denied",
        description: `${actor} attempted an action without the required role.`,
        timestamp: log.createdAt,
        tone: "warning",
        ...(log.targetType ? { targetType: log.targetType } : {}),
        ...(log.targetId ? { targetId: log.targetId } : {}),
      };
    case AuditAction.AUTH_REGISTER:
      return {
        id: log.id,
        title: "User registered",
        description: `${actor} created an account.`,
        timestamp: log.createdAt,
        tone: "brand",
      };
    case AuditAction.AUTH_LOGIN:
      return {
        id: log.id,
        title: "User logged in",
        description: `${actor} signed in successfully.`,
        timestamp: log.createdAt,
        tone: "neutral",
      };
    case AuditAction.AUTH_LOGIN_FAILED:
      return {
        id: log.id,
        title: "Failed login",
        description: `${actor} had a failed login attempt.`,
        timestamp: log.createdAt,
        tone: "warning",
      };
    case AuditAction.AUTH_REFRESH:
      return {
        id: log.id,
        title: "Session refreshed",
        description: `${actor} refreshed a session token.`,
        timestamp: log.createdAt,
        tone: "neutral",
      };
    case AuditAction.AUTH_LOGOUT:
      return {
        id: log.id,
        title: "User logged out",
        description: `${actor} signed out.`,
        timestamp: log.createdAt,
        tone: "neutral",
      };
    case AuditAction.AUTH_SWITCH_TENANT:
      return {
        id: log.id,
        title: "Tenant switched",
        description: `${actor} switched tenant context.`,
        timestamp: log.createdAt,
        tone: "neutral",
      };
    default:
      return {
        id: log.id,
        title: "Activity",
        description: `${actor} triggered ${log.action}.`,
        timestamp: log.createdAt,
        tone: "neutral",
        ...(log.targetType ? { targetType: log.targetType } : {}),
        ...(log.targetId ? { targetId: log.targetId } : {}),
      };
  }
}

export async function listActivityFeed(
  auth: AuthContext,
  query: ActivityListQueryInput,
): Promise<ActivityFeedResult> {
  const skip = (query.page - 1) * query.pageSize;
  const where = {
    tenantId: auth.tenantId,
  } satisfies Prisma.AuditLogWhereInput;

  const [total, logs] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: query.pageSize,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        createdAt: true,
        metadata: true,
        user: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return {
    items: logs.map(mapAuditToFeedItem),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}
