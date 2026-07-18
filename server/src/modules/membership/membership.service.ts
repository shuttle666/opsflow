import { AuditAction, MembershipRole, MembershipStatus, type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { AuthContext, RequestMetadata } from "../../types/auth";
import { ApiError } from "../../utils/api-error";
import { expirePendingTenantInvitations } from "../auth/auth.service";
import type {
  MembershipListQueryInput,
  UpdateMembershipInput,
} from "./membership-schemas";

export type MembershipListItem = {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  role: MembershipRole;
  status: MembershipStatus;
  createdAt: Date;
};

export type MembershipSummary = {
  total: number;
  active: number;
  invited: number;
  disabled: number;
};

type MembershipListResult = {
  items: MembershipListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: MembershipSummary;
};

type TenantMembershipRecord = {
  id: string;
  userId: string;
  role: MembershipRole;
  status: MembershipStatus;
};

function buildMembershipWhere(auth: AuthContext, query: MembershipListQueryInput) {
  const normalizedQuery = query.q?.trim();

  return {
    tenantId: auth.tenantId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.role ? { role: query.role } : {}),
    ...(normalizedQuery
      ? {
          user: {
            OR: [
              {
                displayName: {
                  contains: normalizedQuery,
                  mode: "insensitive" as const,
                },
              },
              {
                email: {
                  contains: normalizedQuery,
                  mode: "insensitive" as const,
                },
              },
            ],
          },
        }
      : {}),
  } satisfies Prisma.MembershipWhereInput;
}

async function getMembershipOrThrow(
  auth: AuthContext,
  membershipId: string,
): Promise<TenantMembershipRecord> {
  const membership = await prisma.membership.findFirst({
    where: {
      id: membershipId,
      tenantId: auth.tenantId,
    },
    select: {
      id: true,
      userId: true,
      role: true,
      status: true,
    },
  });

  if (!membership) {
    throw new ApiError(404, "Membership not found.", "MEMBERSHIP_NOT_FOUND");
  }

  return membership;
}

async function countActiveOwners(tenantId: string) {
  return prisma.membership.count({
    where: {
      tenantId,
      role: MembershipRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
  });
}

export async function listMemberships(
  auth: AuthContext,
  query: MembershipListQueryInput,
): Promise<MembershipListResult> {
  await expirePendingTenantInvitations(auth.tenantId);

  const where = buildMembershipWhere(auth, query);
  const skip = (query.page - 1) * query.pageSize;

  const { total, memberships, statusGroups } = await prisma.$transaction(
    async (tx) => {
      const total = await tx.membership.count({ where });
      const memberships = await tx.membership.findMany({
        where,
        orderBy: [
          { createdAt: "asc" },
          { user: { displayName: "asc" } },
          { id: "asc" },
        ],
        skip,
        take: query.pageSize,
        select: {
          id: true,
          userId: true,
          role: true,
          status: true,
          createdAt: true,
          user: {
            select: {
              displayName: true,
              email: true,
            },
          },
        },
      });
      const statusGroups = await tx.membership.groupBy({
        by: ["status"],
        where: {
          tenantId: auth.tenantId,
        },
        orderBy: {
          status: "asc",
        },
        _count: true,
      });

      return { total, memberships, statusGroups };
    },
  );

  const countForStatus = (status: MembershipStatus) =>
    statusGroups.find((group) => group.status === status)?._count ?? 0;
  const active = countForStatus(MembershipStatus.ACTIVE);
  const invited = countForStatus(MembershipStatus.INVITED);
  const disabled = countForStatus(MembershipStatus.DISABLED);

  return {
    items: memberships.map((membership) => ({
      id: membership.id,
      userId: membership.userId,
      displayName: membership.user.displayName,
      email: membership.user.email,
      role: membership.role,
      status: membership.status,
      createdAt: membership.createdAt,
    })),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
    summary: {
      total: active + invited + disabled,
      active,
      invited,
      disabled,
    },
  };
}

export async function getAssignableStaffMembership(
  auth: AuthContext,
  membershipId: string,
) {
  const membership = await prisma.membership.findFirst({
    where: {
      id: membershipId,
      tenantId: auth.tenantId,
      role: MembershipRole.STAFF,
      status: MembershipStatus.ACTIVE,
    },
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          displayName: true,
        },
      },
    },
  });

  if (!membership) {
    throw new ApiError(
      404,
      "Active staff membership not found.",
      "MEMBERSHIP_NOT_FOUND",
    );
  }

  return {
    membershipId: membership.id,
    userId: membership.userId,
    displayName: membership.user.displayName,
  };
}

export async function updateMembership(
  auth: AuthContext,
  membershipId: string,
  input: UpdateMembershipInput,
  metadata?: RequestMetadata,
): Promise<MembershipListItem> {
  const membership = await getMembershipOrThrow(auth, membershipId);

  if (membership.status === MembershipStatus.INVITED) {
    throw new ApiError(409, "Invited memberships are read-only in this phase.", "MEMBERSHIP_INVITED_READ_ONLY");
  }

  const nextRole = input.role ?? membership.role;
  const nextStatus = input.status ?? membership.status;
  const removesActiveOwner =
    membership.role === MembershipRole.OWNER &&
    membership.status === MembershipStatus.ACTIVE &&
    (nextRole !== MembershipRole.OWNER || nextStatus !== MembershipStatus.ACTIVE);

  if (removesActiveOwner) {
    const activeOwnerCount = await countActiveOwners(auth.tenantId);
    if (activeOwnerCount <= 1) {
      throw new ApiError(
        409,
        "This tenant must keep at least one active owner.",
        "CONFLICT",
      );
    }
  }

  if (nextRole === membership.role && nextStatus === membership.status) {
    const current = await prisma.membership.findUniqueOrThrow({
      where: {
        id: membership.id,
      },
      select: {
        id: true,
        userId: true,
        role: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
    });

    return {
      id: current.id,
      userId: current.userId,
      displayName: current.user.displayName,
      email: current.user.email,
      role: current.role,
      status: current.status,
      createdAt: current.createdAt,
    };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.membership.update({
      where: {
        id: membership.id,
      },
      data: {
        ...(input.role ? { role: input.role } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      select: {
        id: true,
        userId: true,
        role: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        action: AuditAction.MEMBERSHIP_UPDATED,
        tenantId: auth.tenantId,
        userId: auth.userId,
        targetType: "membership",
        targetId: membership.id,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        metadata: {
          memberEmail: saved.user.email,
          memberDisplayName: saved.user.displayName,
          previousRole: membership.role,
          nextRole: saved.role,
          previousStatus: membership.status,
          nextStatus: saved.status,
        },
      },
    });

    return saved;
  });

  return {
    id: updated.id,
    userId: updated.userId,
    displayName: updated.user.displayName,
    email: updated.user.email,
    role: updated.role,
    status: updated.status,
    createdAt: updated.createdAt,
  };
}
