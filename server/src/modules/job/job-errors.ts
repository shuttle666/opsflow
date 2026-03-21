import { ApiError } from "../../utils/api-error";

export type JobDomainErrorCode =
  | "JOB_NOT_FOUND"
  | "CROSS_TENANT_ACCESS"
  | "INVALID_STATUS_TRANSITION"
  | "TENANT_INACTIVE"
  | "TRANSITION_REASON_REQUIRED";

function getStatusCode(code: JobDomainErrorCode) {
  switch (code) {
    case "JOB_NOT_FOUND":
      return 404;
    case "CROSS_TENANT_ACCESS":
      return 403;
    case "TENANT_INACTIVE":
      return 403;
    case "TRANSITION_REASON_REQUIRED":
      return 400;
    case "INVALID_STATUS_TRANSITION":
    default:
      return 409;
  }
}

export class JobDomainError extends ApiError {
  constructor(
    public readonly code: JobDomainErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(getStatusCode(code), message, {
      code,
      ...(details ?? {}),
    });
    this.name = "JobDomainError";
  }
}
