import {
  JobStatus,
  MembershipRole,
  MembershipStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { AuthContext } from "../../types/auth";
import type { DashboardSummaryQueryInput } from "./dashboard-schemas";

type DashboardJobRecord = {
  id: string;
  title: string;
  serviceAddress: string;
  status: JobStatus;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
  createdAt: Date;
  customer: {
    name: string;
  };
  assignedTo: {
    id: string;
    displayName: string;
  } | null;
};

export type DashboardAttentionReason =
  | "PENDING_REVIEW"
  | "NEW_JOB"
  | "UNASSIGNED"
  | "SCHEDULE_CONFLICT";

export type DashboardScheduleItem = {
  id: string;
  customerName: string;
  customerInitials: string;
  serviceAddress: string;
  jobType: string;
  status: JobStatus;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
  assignee?: string;
  hasConflict: boolean;
};

export type DashboardAttentionItem = {
  id: string;
  title: string;
  customer: string;
  status: JobStatus;
  assignee?: string;
  reason: DashboardAttentionReason;
};

export type DashboardSummary = {
  date: string;
  rangeStart: Date;
  rangeEnd: Date;
  generatedAt: Date;
  metrics: {
    todayJobs: number;
    scheduledRows: number;
    assignedJobs: number;
    pendingReview: number;
    unassignedJobs: number;
    activeCrewScheduled: number;
    activeCrewTotal: number;
    needsAttention: number;
    conflictCount: number;
  };
  schedulePreview: DashboardScheduleItem[];
  attentionItems: DashboardAttentionItem[];
};

function getScheduleWindow(date: string, timezoneOffsetMinutes = 0) {
  const [year, month, day] = date.split("-").map((value) => Number(value));
  const startUtcMs =
    Date.UTC(year, month - 1, day, 0, 0, 0) +
    timezoneOffsetMinutes * 60_000;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;

  return {
    start: new Date(startUtcMs),
    end: new Date(endUtcMs),
  };
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function intervalsOverlap(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date,
) {
  return firstStart < secondEnd && firstEnd > secondStart;
}

function findConflictIds(jobs: DashboardJobRecord[]) {
  const conflictIds = new Set<string>();
  const jobsByAssignee = new Map<string, DashboardJobRecord[]>();

  for (const job of jobs) {
    if (!job.assignedTo?.id || !job.scheduledStartAt || !job.scheduledEndAt) {
      continue;
    }

    const assigneeJobs = jobsByAssignee.get(job.assignedTo.id) ?? [];
    assigneeJobs.push(job);
    jobsByAssignee.set(job.assignedTo.id, assigneeJobs);
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

      for (
        let nextIndex = index + 1;
        nextIndex < assigneeJobs.length;
        nextIndex += 1
      ) {
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

  return conflictIds;
}

function getAttentionReason(
  job: DashboardJobRecord,
  conflictIds: Set<string>,
): DashboardAttentionReason | null {
  if (job.status === JobStatus.PENDING_REVIEW) {
    return "PENDING_REVIEW";
  }

  if (conflictIds.has(job.id)) {
    return "SCHEDULE_CONFLICT";
  }

  if (job.status === JobStatus.NEW) {
    return "NEW_JOB";
  }

  if (!job.assignedTo) {
    return "UNASSIGNED";
  }

  return null;
}

function attentionPriority(reason: DashboardAttentionReason) {
  switch (reason) {
    case "PENDING_REVIEW":
      return 0;
    case "SCHEDULE_CONFLICT":
      return 1;
    case "NEW_JOB":
      return 2;
    case "UNASSIGNED":
      return 3;
  }
}

function toScheduleItem(
  job: DashboardJobRecord,
  conflictIds: Set<string>,
): DashboardScheduleItem {
  return {
    id: job.id,
    customerName: job.customer.name,
    customerInitials: initialsFor(job.customer.name),
    serviceAddress: job.serviceAddress,
    jobType: job.title,
    status: job.status,
    scheduledStartAt: job.scheduledStartAt,
    scheduledEndAt: job.scheduledEndAt,
    ...(job.assignedTo ? { assignee: job.assignedTo.displayName } : {}),
    hasConflict: conflictIds.has(job.id),
  };
}

function toAttentionItem(
  job: DashboardJobRecord,
  reason: DashboardAttentionReason,
): DashboardAttentionItem {
  return {
    id: job.id,
    title: job.title,
    customer: job.customer.name,
    status: job.status,
    ...(job.assignedTo ? { assignee: job.assignedTo.displayName } : {}),
    reason,
  };
}

export async function getDashboardSummary(
  auth: AuthContext,
  query: DashboardSummaryQueryInput,
): Promise<DashboardSummary> {
  const { start, end } = getScheduleWindow(
    query.date,
    query.timezoneOffsetMinutes,
  );

  const where = {
    tenantId: auth.tenantId,
    scheduledStartAt: {
      lt: end,
    },
    scheduledEndAt: {
      gt: start,
    },
    ...(auth.role === MembershipRole.STAFF
      ? { assignedToId: auth.userId }
      : {}),
  } satisfies Prisma.JobWhereInput;

  const [jobs, activeCrewTotal] = await prisma.$transaction([
    prisma.job.findMany({
      where,
      orderBy: [{ scheduledStartAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        serviceAddress: true,
        status: true,
        scheduledStartAt: true,
        scheduledEndAt: true,
        createdAt: true,
        customer: {
          select: {
            name: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    }),
    prisma.membership.count({
      where: {
        tenantId: auth.tenantId,
        status: MembershipStatus.ACTIVE,
        role: {
          in: [
            MembershipRole.OWNER,
            MembershipRole.MANAGER,
            MembershipRole.STAFF,
          ],
        },
      },
    }),
  ]);

  const conflictIds = findConflictIds(jobs);
  const attentionCandidates = jobs
    .map((job) => ({
      job,
      reason: getAttentionReason(job, conflictIds),
    }))
    .filter(
      (
        item,
      ): item is {
        job: DashboardJobRecord;
        reason: DashboardAttentionReason;
      } => item.reason !== null,
    )
    .sort((left, right) => {
      const priorityDelta =
        attentionPriority(left.reason) - attentionPriority(right.reason);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return (
        (left.job.scheduledStartAt?.getTime() ?? 0) -
        (right.job.scheduledStartAt?.getTime() ?? 0)
      );
    });

  const activeCrewScheduled = new Set(
    jobs.map((job) => job.assignedTo?.id).filter(Boolean),
  ).size;

  return {
    date: query.date,
    rangeStart: start,
    rangeEnd: end,
    generatedAt: new Date(),
    metrics: {
      todayJobs: jobs.length,
      scheduledRows: jobs.length,
      assignedJobs: jobs.filter((job) => job.assignedTo).length,
      pendingReview: jobs.filter(
        (job) => job.status === JobStatus.PENDING_REVIEW,
      ).length,
      unassignedJobs: jobs.filter((job) => !job.assignedTo).length,
      activeCrewScheduled,
      activeCrewTotal,
      needsAttention: attentionCandidates.length,
      conflictCount: conflictIds.size,
    },
    schedulePreview: jobs
      .slice(0, query.schedulePreviewLimit)
      .map((job) => toScheduleItem(job, conflictIds)),
    attentionItems: attentionCandidates
      .slice(0, query.attentionLimit)
      .map((item) => toAttentionItem(item.job, item.reason)),
  };
}
