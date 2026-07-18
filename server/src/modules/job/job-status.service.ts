import { AuditAction, JobStatus, TenantStatus, type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { RequestMetadata } from "../../types/auth";
import { JobDomainError } from "./job-errors";
import { assertValidTransition } from "./job-status-machine";

export type TransitionJobStatusServiceInput = {
  tenantId: string;
  jobId: string;
  toStatus: JobStatus;
  changedById?: string | null;
  reason?: string;
  metadata?: RequestMetadata;
  expectedAssignedToId?: string;
  expectedFromStatus?: JobStatus;
};

function assertExpectedTransitionState(
  job: { assignedToId: string | null; status: JobStatus },
  input: TransitionJobStatusServiceInput,
) {
  if (
    input.expectedAssignedToId !== undefined &&
    job.assignedToId !== input.expectedAssignedToId
  ) {
    throw new JobDomainError("JOB_NOT_FOUND", "Job not found.", {
      tenantId: input.tenantId,
      jobId: input.jobId,
    });
  }

  if (
    input.expectedFromStatus !== undefined &&
    job.status !== input.expectedFromStatus
  ) {
    throw new JobDomainError(
      "STATUS_TRANSITION_FORBIDDEN",
      "The job is no longer in a state this actor can transition.",
      {
        expectedFromStatus: input.expectedFromStatus,
        actualFromStatus: job.status,
      },
    );
  }
}

export async function transitionJobStatusInTransaction(
  tx: Prisma.TransactionClient,
  input: TransitionJobStatusServiceInput,
) {
  const { tenantId, jobId, toStatus, changedById, reason, metadata } = input;
  const normalizedReason = reason?.trim() ? reason.trim() : null;

  if (toStatus === JobStatus.CANCELLED && !normalizedReason) {
    throw new JobDomainError(
      "TRANSITION_REASON_REQUIRED",
      "Cancelling a job requires a reason.",
      { toStatus },
    );
  }

  const tenant = await tx.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      status: true,
      deletedAt: true,
    },
  });

  if (!tenant || tenant.status !== TenantStatus.ACTIVE || tenant.deletedAt) {
    throw new JobDomainError(
      "TENANT_INACTIVE",
      "Tenant is inactive or unavailable.",
      { tenantId },
    );
  }

  const job = await tx.job.findFirst({
    where: {
      id: jobId,
      tenantId,
    },
    select: {
      id: true,
      tenantId: true,
      status: true,
      assignedToId: true,
    },
  });

  if (!job) {
    const existingJob = await tx.job.findUnique({
      where: { id: jobId },
      select: { tenantId: true },
    });

    if (existingJob && existingJob.tenantId !== tenantId) {
      throw new JobDomainError(
        "CROSS_TENANT_ACCESS",
        "Cross-tenant job access is not allowed.",
        { tenantId, jobId },
      );
    }

    throw new JobDomainError("JOB_NOT_FOUND", "Job not found.", {
      tenantId,
      jobId,
    });
  }

  assertExpectedTransitionState(job, input);
  assertValidTransition(job.status, toStatus);

  let updatedJob;
  if (
    input.expectedAssignedToId !== undefined ||
    input.expectedFromStatus !== undefined
  ) {
    const updated = await tx.job.updateMany({
      where: {
        id: job.id,
        tenantId,
        ...(input.expectedAssignedToId !== undefined
          ? { assignedToId: input.expectedAssignedToId }
          : {}),
        ...(input.expectedFromStatus !== undefined
          ? { status: input.expectedFromStatus }
          : {}),
      },
      data: { status: toStatus },
    });

    if (updated.count !== 1) {
      const currentJob = await tx.job.findFirst({
        where: {
          id: job.id,
          tenantId,
        },
        select: {
          assignedToId: true,
          status: true,
        },
      });

      if (!currentJob) {
        throw new JobDomainError("JOB_NOT_FOUND", "Job not found.", {
          tenantId,
          jobId,
        });
      }

      assertExpectedTransitionState(currentJob, input);
      throw new JobDomainError(
        "STATUS_TRANSITION_FORBIDDEN",
        "The job transition authorization is no longer current.",
      );
    }

    updatedJob = await tx.job.findUniqueOrThrow({
      where: { id: job.id },
    });
  } else {
    updatedJob = await tx.job.update({
      where: { id: job.id },
      data: { status: toStatus },
    });
  }

  const history = await tx.jobStatusHistory.create({
    data: {
      tenantId,
      jobId: job.id,
      fromStatus: job.status,
      toStatus,
      changedById: changedById ?? null,
      reason: normalizedReason,
    },
  });

  await tx.auditLog.create({
    data: {
      action: AuditAction.JOB_STATUS_TRANSITION,
      tenantId,
      userId: changedById ?? null,
      targetType: "job",
      targetId: job.id,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      metadata: {
        fromStatus: job.status,
        toStatus,
        reason: normalizedReason,
      },
    },
  });

  return {
    job: updatedJob,
    history,
  };
}

export async function transitionJobStatus(input: TransitionJobStatusServiceInput) {
  return prisma.$transaction(async (tx) => {
    return transitionJobStatusInTransaction(tx, input);
  });
}
