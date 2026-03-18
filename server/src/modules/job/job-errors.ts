export type JobDomainErrorCode =
  | "JOB_NOT_FOUND"
  | "CROSS_TENANT_ACCESS"
  | "INVALID_STATUS_TRANSITION"
  | "TENANT_INACTIVE";

export class JobDomainError extends Error {
  constructor(
    public readonly code: JobDomainErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "JobDomainError";
  }
}

