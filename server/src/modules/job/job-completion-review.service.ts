import {
  AuditAction,
  JobCompletionReviewStatus,
  JobStatus,
  MembershipRole,
  type Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { AuthContext, RequestMetadata } from "../../types/auth";
import { ApiError } from "../../utils/api-error";
import { getAllowedTransitions } from "./job-status-machine";
import { transitionJobStatusInTransaction } from "./job-status.service";
import { getJobDetail, type JobDetail, type JobHistoryItem } from "./job.service";
import type {
  ReturnJobCompletionReviewInput,
  SubmitJobCompletionReviewInput,
} from "./job-schemas";

const completionReviewSelect = {
  id: true,
  tenantId: true,
  jobId: true,
  completionNote: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  reviewNote: true,
  aiStatus: true,
  aiSummary: true,
  aiFindings: true,
  submittedBy: {
    select: {
      id: true,
      displayName: true,
      email: true,
    },
  },
  reviewedBy: {
    select: {
      id: true,
      displayName: true,
      email: true,
    },
  },
} satisfies Prisma.JobCompletionReviewSelect;

type SelectedCompletionReview = Prisma.JobCompletionReviewGetPayload<{
  select: typeof completionReviewSelect;
}>;

export type JobCompletionReviewItem = {
  id: string;
  jobId: string;
  completionNote: string;
  status: JobCompletionReviewStatus;
  submittedAt: Date;
  submittedBy: {
    id: string;
    displayName: string;
    email: string;
  };
  reviewedAt: Date | null;
  reviewedBy?: {
    id: string;
    displayName: string;
    email: string;
  };
  reviewNote: string | null;
  aiStatus: string | null;
  aiSummary: string | null;
  aiFindings: Prisma.JsonValue | null;
};

export type JobCompletionReviewMutationResult = {
  job: JobDetail;
  review: JobCompletionReviewItem;
  historyEntry: JobHistoryItem;
  allowedTransitions: JobStatus[];
};

function buildVisibleJobWhere(auth: AuthContext, jobId: string): Prisma.JobWhereInput {
  return {
    id: jobId,
    tenantId: auth.tenantId,
    ...(auth.role === MembershipRole.STAFF ? { assignedToId: auth.userId } : {}),
  };
}

function normalizeNote(value: string) {
  return value.trim();
}

function mapCompletionReview(review: SelectedCompletionReview): JobCompletionReviewItem {
  return {
    id: review.id,
    jobId: review.jobId,
    completionNote: review.completionNote,
    status: review.status,
    submittedAt: review.submittedAt,
    submittedBy: review.submittedBy,
    reviewedAt: review.reviewedAt,
    ...(review.reviewedBy ? { reviewedBy: review.reviewedBy } : {}),
    reviewNote: review.reviewNote,
    aiStatus: review.aiStatus,
    aiSummary: review.aiSummary,
    aiFindings: review.aiFindings,
  };
}

async function getVisibleJobOrThrow(auth: AuthContext, jobId: string) {
  const job = await prisma.job.findFirst({
    where: buildVisibleJobWhere(auth, jobId),
    select: {
      id: true,
      tenantId: true,
      title: true,
      status: true,
      assignedToId: true,
    },
  });

  if (!job) {
    throw new ApiError(404, "Job not found.");
  }

  return job;
}

async function getActor(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      email: true,
    },
  });
}

async function buildMutationResult(
  auth: AuthContext,
  jobId: string,
  review: SelectedCompletionReview,
  history: {
    id: string;
    fromStatus: JobStatus;
    toStatus: JobStatus;
    reason: string | null;
    changedAt: Date;
  },
): Promise<JobCompletionReviewMutationResult> {
  const [job, changedBy] = await Promise.all([
    getJobDetail(auth, jobId),
    getActor(auth.userId),
  ]);

  return {
    job,
    review: mapCompletionReview(review),
    historyEntry: {
      id: history.id,
      fromStatus: history.fromStatus,
      toStatus: history.toStatus,
      reason: history.reason,
      changedAt: history.changedAt,
      ...(changedBy ? { changedBy } : {}),
    },
    allowedTransitions: getAllowedTransitions(job.status),
  };
}

export async function getLatestJobCompletionReview(
  auth: AuthContext,
  jobId: string,
): Promise<JobCompletionReviewItem | null> {
  const job = await getVisibleJobOrThrow(auth, jobId);

  const review = await prisma.jobCompletionReview.findFirst({
    where: {
      tenantId: auth.tenantId,
      jobId: job.id,
    },
    orderBy: {
      submittedAt: "desc",
    },
    select: completionReviewSelect,
  });

  return review ? mapCompletionReview(review) : null;
}

export async function submitJobCompletionReview(
  auth: AuthContext,
  jobId: string,
  input: SubmitJobCompletionReviewInput,
  metadata?: RequestMetadata,
): Promise<JobCompletionReviewMutationResult> {
  const job = await getVisibleJobOrThrow(auth, jobId);
  const completionNote = normalizeNote(input.completionNote);

  if (job.status !== JobStatus.IN_PROGRESS) {
    throw new ApiError(409, "Job must be in progress before completion can be submitted.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const review = await tx.jobCompletionReview.create({
      data: {
        tenantId: auth.tenantId,
        jobId: job.id,
        submittedById: auth.userId,
        completionNote,
        status: JobCompletionReviewStatus.PENDING,
      },
      select: completionReviewSelect,
    });

    const transitioned = await transitionJobStatusInTransaction(tx, {
      tenantId: auth.tenantId,
      jobId: job.id,
      toStatus: JobStatus.PENDING_REVIEW,
      changedById: auth.userId,
      reason: "Completion submitted for review.",
      metadata,
    });

    await tx.auditLog.create({
      data: {
        action: AuditAction.JOB_COMPLETION_SUBMITTED,
        tenantId: auth.tenantId,
        userId: auth.userId,
        targetType: "job_completion_review",
        targetId: review.id,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        metadata: {
          jobId: job.id,
          jobTitle: job.title,
        },
      },
    });

    return {
      review,
      history: transitioned.history,
    };
  });

  return buildMutationResult(auth, job.id, result.review, result.history);
}

export async function approveJobCompletionReview(
  auth: AuthContext,
  jobId: string,
  reviewId: string,
  metadata?: RequestMetadata,
): Promise<JobCompletionReviewMutationResult> {
  const job = await getVisibleJobOrThrow(auth, jobId);

  const result = await prisma.$transaction(async (tx) => {
    const review = await tx.jobCompletionReview.findFirst({
      where: {
        id: reviewId,
        tenantId: auth.tenantId,
        jobId: job.id,
      },
      select: {
        ...completionReviewSelect,
        job: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    if (!review) {
      throw new ApiError(404, "Completion review not found.");
    }

    if (review.status !== JobCompletionReviewStatus.PENDING) {
      throw new ApiError(409, "Completion review has already been resolved.");
    }

    if (review.job.status !== JobStatus.PENDING_REVIEW) {
      throw new ApiError(409, "Job must be pending review before completion can be approved.");
    }

    const transitioned = await transitionJobStatusInTransaction(tx, {
      tenantId: auth.tenantId,
      jobId: job.id,
      toStatus: JobStatus.COMPLETED,
      changedById: auth.userId,
      reason: "Completion review approved.",
      metadata,
    });

    const updatedReview = await tx.jobCompletionReview.update({
      where: {
        id: review.id,
      },
      data: {
        status: JobCompletionReviewStatus.APPROVED,
        reviewedById: auth.userId,
        reviewedAt: new Date(),
      },
      select: completionReviewSelect,
    });

    await tx.auditLog.create({
      data: {
        action: AuditAction.JOB_COMPLETION_APPROVED,
        tenantId: auth.tenantId,
        userId: auth.userId,
        targetType: "job_completion_review",
        targetId: review.id,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        metadata: {
          jobId: job.id,
          jobTitle: review.job.title,
        },
      },
    });

    return {
      review: updatedReview,
      history: transitioned.history,
    };
  });

  return buildMutationResult(auth, job.id, result.review, result.history);
}

export async function returnJobCompletionReview(
  auth: AuthContext,
  jobId: string,
  reviewId: string,
  input: ReturnJobCompletionReviewInput,
  metadata?: RequestMetadata,
): Promise<JobCompletionReviewMutationResult> {
  const job = await getVisibleJobOrThrow(auth, jobId);
  const reviewNote = normalizeNote(input.reviewNote);

  const result = await prisma.$transaction(async (tx) => {
    const review = await tx.jobCompletionReview.findFirst({
      where: {
        id: reviewId,
        tenantId: auth.tenantId,
        jobId: job.id,
      },
      select: {
        ...completionReviewSelect,
        job: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    if (!review) {
      throw new ApiError(404, "Completion review not found.");
    }

    if (review.status !== JobCompletionReviewStatus.PENDING) {
      throw new ApiError(409, "Completion review has already been resolved.");
    }

    if (review.job.status !== JobStatus.PENDING_REVIEW) {
      throw new ApiError(409, "Job must be pending review before completion can be returned.");
    }

    const transitioned = await transitionJobStatusInTransaction(tx, {
      tenantId: auth.tenantId,
      jobId: job.id,
      toStatus: JobStatus.IN_PROGRESS,
      changedById: auth.userId,
      reason: `Returned for rework: ${reviewNote}`,
      metadata,
    });

    const updatedReview = await tx.jobCompletionReview.update({
      where: {
        id: review.id,
      },
      data: {
        status: JobCompletionReviewStatus.RETURNED,
        reviewedById: auth.userId,
        reviewedAt: new Date(),
        reviewNote,
      },
      select: completionReviewSelect,
    });

    await tx.auditLog.create({
      data: {
        action: AuditAction.JOB_COMPLETION_RETURNED,
        tenantId: auth.tenantId,
        userId: auth.userId,
        targetType: "job_completion_review",
        targetId: review.id,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        metadata: {
          jobId: job.id,
          jobTitle: review.job.title,
          reviewNote,
        },
      },
    });

    return {
      review: updatedReview,
      history: transitioned.history,
    };
  });

  return buildMutationResult(auth, job.id, result.review, result.history);
}
