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
};

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

  assertValidTransition(job.status, toStatus);

  const updatedJob = await tx.job.update({
    where: { id: job.id },
    data: { status: toStatus },
  });

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
