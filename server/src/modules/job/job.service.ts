import {
  AuditAction,
  JobStatus,
  MembershipRole,
  MembershipStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { AuthContext, RequestMetadata } from "../../types/auth";
import { ApiError } from "../../utils/api-error";
import {
  createJobAssignedNotification,
  createJobStatusChangedNotification,
  createJobUnassignedNotification,
  publishCreatedNotifications,
} from "../notification/notification.service";
import type {
  AssignJobInput,
  CreateJobInput,
  JobListQueryInput,
  ScheduleDayQueryInput,
  ScheduleRangeQueryInput,
  TransitionJobStatusInput,
  UpdateJobInput,
} from "./job-schemas";
import { getAllowedTransitions } from "./job-status-machine";
import { transitionJobStatus } from "./job-status.service";

type JobCustomerSummary = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
};

type JobTiming = {
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
};

type JobListItem = JobTiming & {
  id: string;
  title: string;
  serviceAddress: string;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
  customer: {
    id: string;
    name: string;
  };
  assignedToName?: string;
};

export type JobDetail = JobTiming & {
  id: string;
  title: string;
  serviceAddress: string;
  description: string | null;
  status: JobStatus;
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

export type ScheduleDayJobItem = JobTiming & {
  id: string;
  title: string;
  serviceAddress: string;
  status: JobStatus;
  customer: {
    id: string;
    name: string;
  };
  assignedTo?: {
    id: string;
    displayName: string;
    email: string;
  };
  hasConflict: boolean;
};

export type ScheduleLane = {
  key: string;
  label: string;
  membershipId?: string;
  userId?: string;
  jobs: ScheduleDayJobItem[];
  hasConflict: boolean;
};

export type ScheduleRangeResult = {
  rangeStart: Date;
  rangeEnd: Date;
  lanes: ScheduleLane[];
  totalJobs: number;
  conflictCount: number;
};

export type ScheduleDayResult = ScheduleRangeResult & {
  date: string;
};

export type ScheduleConflictItem = {
  id: string;
  title: string;
  serviceAddress: string;
  status: JobStatus;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  customer: {
    id: string;
    name: string;
  };
};

export type ScheduleConflictCheckResult = {
  hasConflict: boolean;
  conflicts: ScheduleConflictItem[];
};

const activeSchedulingStatuses = [
  JobStatus.NEW,
  JobStatus.SCHEDULED,
  JobStatus.IN_PROGRESS,
  JobStatus.PENDING_REVIEW,
] satisfies JobStatus[];

// A 42-local-day calendar grid can be slightly longer in UTC across DST.
const maxScheduleRangeMs = 42 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000;

function normalizeOptionalString(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalDateTime(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? new Date(trimmed) : null;
}

function normalizeScheduledRange(input: {
  scheduledStartAt?: string;
  scheduledEndAt?: string;
}): {
  scheduledAt: Date | null;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
} {
  const scheduledStartAt = normalizeOptionalDateTime(input.scheduledStartAt);
  const scheduledEndAt = normalizeOptionalDateTime(input.scheduledEndAt);

  if ((scheduledStartAt && !scheduledEndAt) || (!scheduledStartAt && scheduledEndAt)) {
    throw new ApiError(400, "Both start and end time are required when scheduling a job.");
  }

  if (scheduledStartAt && scheduledEndAt && scheduledEndAt <= scheduledStartAt) {
    throw new ApiError(400, "End time must be after the start time.");
  }

  return {
    scheduledAt: scheduledStartAt,
    scheduledStartAt,
    scheduledEndAt,
  };
}

function buildOverlapRangeWhere(input: {
  scheduledFrom?: string;
  scheduledTo?: string;
}): Prisma.JobWhereInput | undefined {
  const from = input.scheduledFrom ? new Date(input.scheduledFrom) : null;
  const to = input.scheduledTo ? new Date(input.scheduledTo) : null;

  if (!from && !to) {
    return undefined;
  }

  return {
    scheduledStartAt: {
      ...(to ? { lt: to } : {}),
    },
    scheduledEndAt: {
      ...(from ? { gt: from } : {}),
    },
  } satisfies Prisma.JobWhereInput;
}

function getScheduleWindow(date: string, timezoneOffsetMinutes = 0) {
  const [year, month, day] = date.split("-").map((value) => Number(value));
  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0) + timezoneOffsetMinutes * 60_000;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;

  return {
    start: new Date(startUtcMs),
    end: new Date(endUtcMs),
  };
}

function buildJobDetailWhere(auth: AuthContext, jobId: string): Prisma.JobWhereInput {
  return {
    id: jobId,
    tenantId: auth.tenantId,
    ...(auth.role === MembershipRole.STAFF ? { assignedToId: auth.userId } : {}),
  };
}

function buildJobOrderBy(sort: JobListQueryInput["sort"]) {
  switch (sort) {
    case "createdAt_asc":
      return { createdAt: "asc" } satisfies Prisma.JobOrderByWithRelationInput;
    case "scheduledStartAt_asc":
      return { scheduledStartAt: "asc" } satisfies Prisma.JobOrderByWithRelationInput;
    case "scheduledStartAt_desc":
      return { scheduledStartAt: "desc" } satisfies Prisma.JobOrderByWithRelationInput;
    case "createdAt_desc":
    default:
      return { createdAt: "desc" } satisfies Prisma.JobOrderByWithRelationInput;
  }
}

function buildJobWhere(auth: AuthContext, query: JobListQueryInput) {
  const normalizedQuery = query.q?.trim();
  const overlapWhere = buildOverlapRangeWhere(query);

  return {
    tenantId: auth.tenantId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(overlapWhere ?? {}),
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
              serviceAddress: {
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

function mapJobListItem(job: {
  id: string;
  title: string;
  serviceAddress: string;
  status: JobStatus;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
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
    serviceAddress: job.serviceAddress,
    status: job.status,
    scheduledStartAt: job.scheduledStartAt,
    scheduledEndAt: job.scheduledEndAt,
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
  serviceAddress: string;
  description: string | null;
  status: JobStatus;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
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
    serviceAddress: job.serviceAddress,
    description: job.description,
    status: job.status,
    scheduledStartAt: job.scheduledStartAt,
    scheduledEndAt: job.scheduledEndAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    customer: job.customer,
    createdBy: job.createdBy,
    ...(job.assignedTo ? { assignedTo: job.assignedTo } : {}),
  };
}

function intervalsOverlap(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date,
) {
  return firstStart < secondEnd && firstEnd > secondStart;
}

function applyConflictFlags(
  jobs: Array<
    Omit<ScheduleDayJobItem, "hasConflict"> & {
      assignedTo?: {
        id: string;
        displayName: string;
        email: string;
      };
    }
  >,
) {
  const conflictIds = new Set<string>();
  const jobsByAssignee = new Map<string, typeof jobs>();

  for (const job of jobs) {
    if (!job.assignedTo?.id || !job.scheduledStartAt || !job.scheduledEndAt) {
      continue;
    }

    const current = jobsByAssignee.get(job.assignedTo.id) ?? [];
    current.push(job);
    jobsByAssignee.set(job.assignedTo.id, current);
  }

  for (const assigneeJobs of jobsByAssignee.values()) {
    assigneeJobs.sort(
      (left, right) =>
        left.scheduledStartAt!.getTime() - right.scheduledStartAt!.getTime(),
    );

    for (let index = 0; index < assigneeJobs.length; index += 1) {
      const current = assigneeJobs[index];
      if (!current?.scheduledStartAt || !current.scheduledEndAt) {
        continue;
      }

      for (let nextIndex = index + 1; nextIndex < assigneeJobs.length; nextIndex += 1) {
        const next = assigneeJobs[nextIndex];
        if (!next?.scheduledStartAt || !next.scheduledEndAt) {
          continue;
        }

        if (next.scheduledStartAt >= current.scheduledEndAt) {
          break;
        }

        if (
          intervalsOverlap(
            current.scheduledStartAt,
            current.scheduledEndAt,
            next.scheduledStartAt,
            next.scheduledEndAt,
          )
        ) {
          conflictIds.add(current.id);
          conflictIds.add(next.id);
        }
      }
    }
  }

  return {
    jobs: jobs.map((job) => ({
      ...job,
      hasConflict: conflictIds.has(job.id),
    })),
    conflictCount: conflictIds.size,
  };
}

async function getTenantCustomerOrThrow(
  auth: AuthContext,
  customerId: string,
  options: { allowArchived?: boolean } = {},
) {
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      tenantId: auth.tenantId,
      ...(options.allowArchived ? {} : { archivedAt: null }),
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

async function getAssignableMembershipOrThrow(auth: AuthContext, membershipId: string) {
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

  if (
    membership.status !== MembershipStatus.ACTIVE ||
    membership.role !== MembershipRole.STAFF
  ) {
    throw new ApiError(409, "Jobs can only be assigned to active staff members.");
  }

  return membership;
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
        serviceAddress: true,
        status: true,
        scheduledStartAt: true,
        scheduledEndAt: true,
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
  const scheduling = normalizeScheduledRange(input);

  const job = await prisma.job.create({
    data: {
      tenantId: auth.tenantId,
      customerId: customer.id,
      title: input.title.trim(),
      serviceAddress: input.serviceAddress.trim(),
      description: normalizeOptionalString(input.description),
      ...scheduling,
      createdById: auth.userId,
      status: JobStatus.NEW,
    },
    select: {
      id: true,
      title: true,
      serviceAddress: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
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
      serviceAddress: true,
      description: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
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
  const currentJob = await getJobOrThrow(auth, jobId);
  const customer = await getTenantCustomerOrThrow(auth, input.customerId, {
    allowArchived: input.customerId === currentJob.customerId,
  });
  const scheduling = normalizeScheduledRange(input);

  const job = await prisma.job.update({
    where: {
      id: jobId,
    },
    data: {
      customerId: customer.id,
      title: input.title.trim(),
      serviceAddress: input.serviceAddress.trim(),
      description: normalizeOptionalString(input.description),
      ...scheduling,
    },
    select: {
      id: true,
      title: true,
      serviceAddress: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
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
        serviceAddress: true,
        status: true,
        scheduledStartAt: true,
        scheduledEndAt: true,
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

export async function getScheduleDay(
  auth: AuthContext,
  query: ScheduleDayQueryInput & { timezoneOffsetMinutes?: number },
): Promise<ScheduleDayResult> {
  const { start, end } = getScheduleWindow(
    query.date,
    query.timezoneOffsetMinutes ?? 0,
  );

  const range = await loadScheduleRange(auth, {
    rangeStart: start,
    rangeEnd: end,
    assigneeId: query.assigneeId,
  });

  return {
    date: query.date,
    ...range,
  };
}

function assertValidScheduleRange(rangeStart: Date, rangeEnd: Date) {
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    throw new ApiError(400, "Invalid schedule range.");
  }

  if (rangeEnd <= rangeStart) {
    throw new ApiError(400, "Range end must be after range start.");
  }

  if (rangeEnd.getTime() - rangeStart.getTime() > maxScheduleRangeMs) {
    throw new ApiError(400, "Schedule range cannot exceed 42 days.");
  }
}

async function loadScheduleRange(
  auth: AuthContext,
  input: {
    rangeStart: Date;
    rangeEnd: Date;
    assigneeId?: string;
  },
): Promise<ScheduleRangeResult> {
  assertValidScheduleRange(input.rangeStart, input.rangeEnd);

  const effectiveAssigneeId =
    auth.role === MembershipRole.STAFF ? auth.userId : input.assigneeId;

  const [memberships, jobs] = await prisma.$transaction([
    prisma.membership.findMany({
      where: {
        tenantId: auth.tenantId,
        role: MembershipRole.STAFF,
        status: MembershipStatus.ACTIVE,
        ...(effectiveAssigneeId ? { userId: effectiveAssigneeId } : {}),
      },
      orderBy: {
        user: {
          displayName: "asc",
        },
      },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    }),
    prisma.job.findMany({
      where: {
        tenantId: auth.tenantId,
        scheduledStartAt: {
          lt: input.rangeEnd,
        },
        scheduledEndAt: {
          gt: input.rangeStart,
        },
        ...(effectiveAssigneeId ? { assignedToId: effectiveAssigneeId } : {}),
      },
      orderBy: [
        { scheduledStartAt: "asc" },
        { createdAt: "asc" },
      ],
      select: {
        id: true,
        title: true,
        serviceAddress: true,
        status: true,
        scheduledStartAt: true,
        scheduledEndAt: true,
        customer: {
          select: {
            id: true,
            name: true,
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
    }),
  ]);

  const conflictApplied = applyConflictFlags(
    jobs.map((job) => ({
      id: job.id,
      title: job.title,
      serviceAddress: job.serviceAddress,
      status: job.status,
      scheduledStartAt: job.scheduledStartAt,
      scheduledEndAt: job.scheduledEndAt,
      customer: job.customer,
      ...(job.assignedTo ? { assignedTo: job.assignedTo } : {}),
    })),
  );

  const jobsByAssignee = new Map<string, ScheduleDayJobItem[]>();
  const unassignedJobs: ScheduleDayJobItem[] = [];

  for (const job of conflictApplied.jobs) {
    if (!job.assignedTo?.id) {
      unassignedJobs.push(job);
      continue;
    }

    const current = jobsByAssignee.get(job.assignedTo.id) ?? [];
    current.push(job);
    jobsByAssignee.set(job.assignedTo.id, current);
  }

  const lanes: ScheduleLane[] = memberships.map((membership) => {
    const laneJobs = jobsByAssignee.get(membership.userId) ?? [];
    return {
      key: membership.userId,
      label: membership.user.displayName,
      membershipId: membership.id,
      userId: membership.userId,
      jobs: laneJobs,
      hasConflict: laneJobs.some((job) => job.hasConflict),
    };
  });

  if (auth.role !== MembershipRole.STAFF) {
    lanes.push({
      key: "unassigned",
      label: "Unassigned",
      jobs: unassignedJobs,
      hasConflict: false,
    });
  }

  return {
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    lanes,
    totalJobs: conflictApplied.jobs.length,
    conflictCount: conflictApplied.conflictCount,
  };
}

export async function getScheduleRange(
  auth: AuthContext,
  query: ScheduleRangeQueryInput,
): Promise<ScheduleRangeResult> {
  return loadScheduleRange(auth, {
    rangeStart: new Date(query.rangeStart),
    rangeEnd: new Date(query.rangeEnd),
    assigneeId: query.assigneeId,
  });
}

export async function checkScheduleConflicts(
  auth: AuthContext,
  input: {
    assigneeUserId: string;
    scheduledStartAt: string;
    scheduledEndAt: string;
    excludeJobId?: string;
  },
): Promise<ScheduleConflictCheckResult> {
  const scheduledStartAt = new Date(input.scheduledStartAt);
  const scheduledEndAt = new Date(input.scheduledEndAt);

  if (Number.isNaN(scheduledStartAt.getTime()) || Number.isNaN(scheduledEndAt.getTime())) {
    throw new ApiError(400, "Invalid schedule range.");
  }

  const conflicts = await prisma.job.findMany({
    where: {
      tenantId: auth.tenantId,
      assignedToId: input.assigneeUserId,
      status: {
        in: activeSchedulingStatuses,
      },
      ...(input.excludeJobId ? { id: { not: input.excludeJobId } } : {}),
      scheduledStartAt: {
        lt: scheduledEndAt,
      },
      scheduledEndAt: {
        gt: scheduledStartAt,
      },
    },
    orderBy: {
      scheduledStartAt: "asc",
    },
    select: {
      id: true,
      title: true,
      serviceAddress: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return {
    hasConflict: conflicts.length > 0,
    conflicts: conflicts.map((job) => ({
      id: job.id,
      title: job.title,
      serviceAddress: job.serviceAddress,
      status: job.status,
      scheduledStartAt: job.scheduledStartAt!,
      scheduledEndAt: job.scheduledEndAt!,
      customer: job.customer,
    })),
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

  const notifications = await prisma.$transaction(async (tx) => {
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

    return createJobAssignedNotification(tx, {
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      recipientUserId: membership.userId,
      jobId: updated.id,
      jobTitle: updated.title,
    });
  });

  await publishCreatedNotifications(notifications);

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
  const previousAssigneeId = current.assignedToId;

  const notifications = await prisma.$transaction(async (tx) => {
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

    return createJobUnassignedNotification(tx, {
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      recipientUserId: previousAssigneeId,
      jobId: existing.id,
      jobTitle: current.title,
    });
  });

  await publishCreatedNotifications(notifications);

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
      title: true,
      assignedToId: true,
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
  const notifications = await prisma.$transaction((tx) =>
    createJobStatusChangedNotification(tx, {
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      recipientUserId: visibleJob.assignedToId,
      jobId: visibleJob.id,
      jobTitle: visibleJob.title,
      fromStatus: transitioned.history.fromStatus,
      toStatus: transitioned.history.toStatus,
    }),
  );
  await publishCreatedNotifications(notifications);

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
