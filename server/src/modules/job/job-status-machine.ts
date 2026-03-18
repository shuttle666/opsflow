import { JobStatus } from "@prisma/client";
import { JobDomainError } from "./job-errors";

const allowedTransitions: Record<JobStatus, JobStatus[]> = {
  [JobStatus.NEW]: [JobStatus.SCHEDULED, JobStatus.CANCELLED],
  [JobStatus.SCHEDULED]: [JobStatus.IN_PROGRESS, JobStatus.CANCELLED],
  [JobStatus.IN_PROGRESS]: [JobStatus.COMPLETED, JobStatus.CANCELLED],
  [JobStatus.COMPLETED]: [],
  [JobStatus.CANCELLED]: [],
};

export function canTransition(from: JobStatus, to: JobStatus) {
  return allowedTransitions[from].includes(to);
}

export function assertValidTransition(from: JobStatus, to: JobStatus) {
  if (canTransition(from, to)) {
    return;
  }

  throw new JobDomainError(
    "INVALID_STATUS_TRANSITION",
    `Invalid job status transition: ${from} -> ${to}.`,
    { from, to },
  );
}

