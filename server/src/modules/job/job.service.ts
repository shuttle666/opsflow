import { AuditAction, JobStatus, MembershipRole, MembershipStatus, type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { AuthContext, RequestMetadata } from "../../types/auth";
import { ApiError } from "../../utils/api-error";
import type {
  AssignJobInput,
  CreateJobInput,
  JobListQueryInput,
  TransitionJobStatusInput,
  UpdateJobInput,
} from "./job-schemas";
import { canTransition } from "./job-status-machine";
import { transitionJobStatus } from "./job-status.service";

type JobCustomerSummary = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
};

type JobListItem = {
  id: string;
  title: string;
  status: JobStatus;
  scheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customer: {
    id: string;
    name: string;
  };
  assignedToName?: string;
};

type JobDetail = {
  id: string;
  title: string;
  description: string | null;
  status: JobStatus;
  scheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customer: JobCustomerSummary;
  createdBy: {
    id: string;
    displayName: string;
    email: string;
  };
  assignedTo?: {
    id: string;
    displayName: string;
    email: string;
  };
};

type JobListResult = {
  items: JobListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type JobHistoryItem = {
  id: string;
  fromStatus: JobStatus;
  toStatus: JobStatus;
  reason: string | null;
  changedAt: Date;
  changedBy?: {
    id: string;
    displayName: string;
    email: string;
  };
};

export type JobHistoryResult = {
  history: JobHistoryItem[];
  allowedTransitions: JobStatus[];
};

export type JobStatusTransitionResult = {
  job: JobDetail;
  historyEntry: JobHistoryItem;
  allowedTransitions: JobStatus[];
};

function normalizeOptionalString(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalDateTime(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? new Date(trimmed) : null;
}

function getAllowedTransitions(from: JobStatus) {
  return (
    Object.values(JobStatus).filter((candidate) => canTransition(from, candidate))
  );
}

async function getTenantCustomerOrThrow(auth: AuthContext, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      tenantId: auth.tenantId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!customer) {
    throw new ApiError(404, "Customer not found.");
  }

  return customer;
}

async function getJobOrThrow(auth: AuthContext, jobId: string) {
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      tenantId: auth.tenantId,
    },
    select: {
      id: true,
      customerId: true,
    },
  });

  if (!job) {
    throw new ApiError(404, "Job not found.");
  }

  return job;
}

async function getAssignableMembershipOrThrow(
  auth: AuthContext,
  membershipId: string,
) {
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
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });

  if (!membership) {
    throw new ApiError(404, "Membership not found.");
  }

  if (membership.status !== MembershipStatus.ACTIVE || membership.role !== MembershipRole.STAFF) {
    throw new ApiError(409, "Jobs can only be assigned to active staff members.");
  }

  return membership;
}

function buildJobDetailWhere(auth: AuthContext, jobId: string): Prisma.JobWhereInput {
  return {
    id: jobId,
    tenantId: auth.tenantId,
    ...(auth.role === MembershipRole.STAFF ? { assignedToId: auth.userId } : {}),
  };
}

function mapJobListItem(job: {
  id: string;
  title: string;
  status: JobStatus;
  scheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customer: {
    id: string;
    name: string;
  };
  assignedTo: {
    displayName: string;
  } | null;
}): JobListItem {
  return {
    id: job.id,
    title: job.title,
    status: job.status,
    scheduledAt: job.scheduledAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    customer: job.customer,
    ...(job.assignedTo?.displayName
      ? { assignedToName: job.assignedTo.displayName }
      : {}),
  };
}

function mapJobDetail(job: {
  id: string;
  title: string;
  description: string | null;
  status: JobStatus;
  scheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customer: JobCustomerSummary;
  createdBy: {
    id: string;
    displayName: string;
    email: string;
  };
  assignedTo: {
    id: string;
    displayName: string;
    email: string;
  } | null;
}): JobDetail {
  return {
    id: job.id,
    title: job.title,
    description: job.description,
    status: job.status,
    scheduledAt: job.scheduledAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    customer: job.customer,
    createdBy: job.createdBy,
    ...(job.assignedTo ? { assignedTo: job.assignedTo } : {}),
  };
}

function buildJobWhere(auth: AuthContext, query: JobListQueryInput) {
  const normalizedQuery = query.q?.trim();

  return {
    tenantId: auth.tenantId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.scheduledFrom || query.scheduledTo
      ? {
          scheduledAt: {
            ...(query.scheduledFrom ? { gte: new Date(query.scheduledFrom) } : {}),
            ...(query.scheduledTo ? { lte: new Date(query.scheduledTo) } : {}),
          },
        }
      : {}),
    ...(normalizedQuery
      ? {
          OR: [
            {
              title: {
                contains: normalizedQuery,
                mode: "insensitive" as const,
              },
            },
            {
              description: {
                contains: normalizedQuery,
                mode: "insensitive" as const,
              },
            },
            {
              customer: {
                name: {
                  contains: normalizedQuery,
                  mode: "insensitive" as const,
                },
              },
            },
          ],
        }
      : {}),
  } satisfies Prisma.JobWhereInput;
}

function buildJobOrderBy(sort: JobListQueryInput["sort"]) {
  switch (sort) {
    case "createdAt_asc":
      return { createdAt: "asc" } satisfies Prisma.JobOrderByWithRelationInput;
    case "scheduledAt_asc":
      return { scheduledAt: "asc" } satisfies Prisma.JobOrderByWithRelationInput;
    case "scheduledAt_desc":
      return { scheduledAt: "desc" } satisfies Prisma.JobOrderByWithRelationInput;
    case "createdAt_desc":
    default:
      return { createdAt: "desc" } satisfies Prisma.JobOrderByWithRelationInput;
  }
}

export async function listJobs(
  auth: AuthContext,
  query: JobListQueryInput,
): Promise<JobListResult> {
  const where = buildJobWhere(auth, query);
  const orderBy = buildJobOrderBy(query.sort);
  const skip = (query.page - 1) * query.pageSize;

  const [total, jobs] = await prisma.$transaction([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy,
      skip,
      take: query.pageSize,
      select: {
        id: true,
        title: true,
        status: true,
        scheduledAt: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedTo: {
          select: {
            displayName: true,
          },
        },
      },
    }),
  ]);

  return {
    items: jobs.map(mapJobListItem),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function createJob(
  auth: AuthContext,
  input: CreateJobInput,
): Promise<JobListItem> {
  const customer = await getTenantCustomerOrThrow(auth, input.customerId);

  const job = await prisma.job.create({
    data: {
      tenantId: auth.tenantId,
      customerId: customer.id,
      title: input.title.trim(),
      description: normalizeOptionalString(input.description),
      scheduledAt: normalizeOptionalDateTime(input.scheduledAt),
      createdById: auth.userId,
      status: JobStatus.NEW,
    },
    select: {
      id: true,
      title: true,
      status: true,
      scheduledAt: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
      assignedTo: {
        select: {
          displayName: true,
        },
      },
    },
  });

  return mapJobListItem(job);
}

export async function getJobDetail(
  auth: AuthContext,
  jobId: string,
): Promise<JobDetail> {
  const job = await prisma.job.findFirst({
    where: buildJobDetailWhere(auth, jobId),
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      scheduledAt: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });

  if (!job) {
    throw new ApiError(404, "Job not found.");
  }

  return mapJobDetail(job);
}

export async function updateJob(
  auth: AuthContext,
  jobId: string,
  input: UpdateJobInput,
): Promise<JobListItem> {
  await getJobOrThrow(auth, jobId);
  const customer = await getTenantCustomerOrThrow(auth, input.customerId);

  const job = await prisma.job.update({
    where: {
      id: jobId,
    },
    data: {
      customerId: customer.id,
      title: input.title.trim(),
      description: normalizeOptionalString(input.description),
      scheduledAt: normalizeOptionalDateTime(input.scheduledAt),
    },
    select: {
      id: true,
      title: true,
      status: true,
      scheduledAt: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
      assignedTo: {
        select: {
          displayName: true,
        },
      },
    },
  });

  return mapJobListItem(job);
}

export async function listMyJobs(
  auth: AuthContext,
  query: JobListQueryInput,
): Promise<JobListResult> {
  const where = {
    ...buildJobWhere(auth, query),
    assignedToId: auth.userId,
  } satisfies Prisma.JobWhereInput;
  const orderBy = buildJobOrderBy(query.sort);
  const skip = (query.page - 1) * query.pageSize;

  const [total, jobs] = await prisma.$transaction([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy,
      skip,
      take: query.pageSize,
      select: {
        id: true,
        title: true,
        status: true,
        scheduledAt: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedTo: {
          select: {
            displayName: true,
          },
        },
      },
    }),
  ]);

  return {
    items: jobs.map(mapJobListItem),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function assignJob(
  auth: AuthContext,
  jobId: string,
  input: AssignJobInput,
  metadata?: RequestMetadata,
): Promise<JobDetail> {
  const existing = await getJobOrThrow(auth, jobId);
  const membership = await getAssignableMembershipOrThrow(auth, input.membershipId);

  if (existing.id && membership.userId) {
    const current = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        assignedToId: true,
        title: true,
      },
    });

    if (current?.assignedToId === membership.userId) {
      return getJobDetail(auth, jobId);
    }
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.job.update({
      where: {
        id: jobId,
      },
      data: {
        assignedToId: membership.userId,
      },
      select: {
        id: true,
        title: true,
      },
    });

    await tx.auditLog.create({
      data: {
        action: AuditAction.JOB_ASSIGNED,
        tenantId: auth.tenantId,
        userId: auth.userId,
        targetType: "job",
        targetId: updated.id,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        metadata: {
          jobTitle: updated.title,
          assigneeId: membership.user.id,
          assigneeName: membership.user.displayName,
          assigneeEmail: membership.user.email,
        },
      },
    });
  });

  return getJobDetail(auth, jobId);
}

export async function unassignJob(
  auth: AuthContext,
  jobId: string,
  metadata?: RequestMetadata,
): Promise<JobDetail> {
  const existing = await getJobOrThrow(auth, jobId);
  const current = await prisma.job.findUnique({
    where: { id: existing.id },
    select: {
      id: true,
      title: true,
      assignedToId: true,
      assignedTo: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });

  if (!current) {
    throw new ApiError(404, "Job not found.");
  }

  if (!current.assignedToId) {
    return getJobDetail(auth, jobId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: {
        id: existing.id,
      },
      data: {
        assignedToId: null,
      },
    });

    await tx.auditLog.create({
      data: {
        action: AuditAction.JOB_UNASSIGNED,
        tenantId: auth.tenantId,
        userId: auth.userId,
        targetType: "job",
        targetId: existing.id,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        metadata: {
          jobTitle: current.title,
          assigneeId: current.assignedTo?.id,
          assigneeName: current.assignedTo?.displayName,
          assigneeEmail: current.assignedTo?.email,
        },
      },
    });
  });

  return getJobDetail(auth, jobId);
}

export async function getJobHistory(
  auth: AuthContext,
  jobId: string,
): Promise<JobHistoryResult> {
  const job = await prisma.job.findFirst({
    where: buildJobDetailWhere(auth, jobId),
    select: {
      id: true,
      status: true,
    },
  });

  if (!job) {
    throw new ApiError(404, "Job not found.");
  }

  const history = await prisma.jobStatusHistory.findMany({
    where: {
      tenantId: auth.tenantId,
      jobId,
    },
    orderBy: {
      changedAt: "asc",
    },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      reason: true,
      changedAt: true,
      changedBy: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });

  return {
    history: history.map((entry) => ({
      id: entry.id,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      reason: entry.reason,
      changedAt: entry.changedAt,
      ...(entry.changedBy ? { changedBy: entry.changedBy } : {}),
    })),
    allowedTransitions: getAllowedTransitions(job.status),
  };
}

export async function transitionJobStatusForActor(
  auth: AuthContext,
  jobId: string,
  input: TransitionJobStatusInput,
  metadata?: RequestMetadata,
): Promise<JobStatusTransitionResult> {
  const visibleJob = await prisma.job.findFirst({
    where: buildJobDetailWhere(auth, jobId),
    select: {
      id: true,
      tenantId: true,
    },
  });

  if (!visibleJob) {
    throw new ApiError(404, "Job not found.");
  }

  const transitioned = await transitionJobStatus({
    tenantId: auth.tenantId,
    jobId: visibleJob.id,
    toStatus: input.toStatus,
    changedById: auth.userId,
    reason: input.reason,
    metadata,
  });

  const job = await getJobDetail(auth, visibleJob.id);
  const changedBy = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      displayName: true,
      email: true,
    },
  });

  return {
    job,
    historyEntry: {
      id: transitioned.history.id,
      fromStatus: transitioned.history.fromStatus,
      toStatus: transitioned.history.toStatus,
      reason: transitioned.history.reason,
      changedAt: transitioned.history.changedAt,
      ...(changedBy ? { changedBy } : {}),
    },
    allowedTransitions: getAllowedTransitions(job.status),
  };
}
