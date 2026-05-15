import { ApiError } from "../../utils/api-error";

export type AuthErrorCode =
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
  | "INVITATION_USER_MISMATCH";

export class AuthError extends ApiError {
  constructor(
    code: AuthErrorCode,
    message: string,
    statusCode = 401,
    details?: Record<string, unknown>,
  ) {
    super(statusCode, message, `AUTH_${code}`, {
      ...(details ?? {}),
    });
  }
}
