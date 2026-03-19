import { ApiError } from "../../utils/api-error";

export class AuthError extends ApiError {
  constructor(
    public readonly code:
      | "INVALID_CREDENTIALS"
      | "SESSION_EXPIRED"
      | "SESSION_REVOKED"
      | "TENANT_INACTIVE"
      | "MEMBERSHIP_INACTIVE"
      | "FORBIDDEN_ROLE"
      | "TENANT_NOT_FOUND"
      | "INVITATION_NOT_FOUND"
      | "INVITATION_EXPIRED"
      | "INVITATION_ALREADY_USED"
      | "INVITATION_USER_MISMATCH",
    message: string,
    statusCode = 401,
    details?: Record<string, unknown>,
  ) {
    super(statusCode, message, {
      code,
      ...(details ?? {}),
    });
  }
}

