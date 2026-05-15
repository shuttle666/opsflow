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

function toApiErrorCode(code: JobDomainErrorCode) {
  switch (code) {
    case "CROSS_TENANT_ACCESS":
      return "JOB_CROSS_TENANT_ACCESS";
    case "INVALID_STATUS_TRANSITION":
      return "JOB_INVALID_STATUS_TRANSITION";
    case "TENANT_INACTIVE":
      return "AUTH_TENANT_INACTIVE";
    case "TRANSITION_REASON_REQUIRED":
      return "JOB_TRANSITION_REASON_REQUIRED";
    case "JOB_NOT_FOUND":
    default:
      return "JOB_NOT_FOUND";
  }
}

export class JobDomainError extends ApiError {
  constructor(
    code: JobDomainErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(getStatusCode(code), message, toApiErrorCode(code), details);
    this.name = "JobDomainError";
  }
}
