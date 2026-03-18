import { JobStatus, TenantStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { JobDomainError } from "./job-errors";
import { assertValidTransition } from "./job-status-machine";

export type TransitionJobStatusInput = {
  tenantId: string;
  jobId: string;
  toStatus: JobStatus;
  changedById?: string | null;
  reason?: string;
};

export async function transitionJobStatus(input: TransitionJobStatusInput) {
  const { tenantId, jobId, toStatus, changedById, reason } = input;

  return prisma.$transaction(async (tx) => {
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
        reason: reason?.trim() ? reason.trim() : null,
      },
    });

    return {
      job: updatedJob,
      history,
    };
  });
}

