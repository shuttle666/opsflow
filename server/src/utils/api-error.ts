export type ApiErrorCode =
  | "BAD_REQUEST"
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "UPLOAD_FAILED"
  | "UPLOAD_FILE_TOO_LARGE"
  | "INTERNAL_ERROR"
  | string;

export function fallbackErrorCodeForStatus(statusCode: number): ApiErrorCode {
  switch (statusCode) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "AUTHENTICATION_REQUIRED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "RATE_LIMITED";
    default:
      return statusCode >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST";
  }
}

function codeFromDetails(details: unknown) {
  if (details && typeof details === "object" && "code" in details) {
    const code = (details as { code?: unknown }).code;
    if (typeof code === "string" && code.trim()) {
      return code.trim();
    }
  }

  return undefined;
}

export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly details?: unknown;

  constructor(
    public readonly statusCode: number,
    message: string,
    codeOrDetails?: ApiErrorCode | unknown,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";

    if (typeof codeOrDetails === "string") {
      this.code = codeOrDetails;
      this.details = details;
      return;
    }

    this.details = codeOrDetails;
    this.code = codeFromDetails(codeOrDetails) ?? fallbackErrorCodeForStatus(statusCode);
  }
}
