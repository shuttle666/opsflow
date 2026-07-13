import { z } from "zod";
import { ApiError } from "../../utils/api-error";
import type { ToolErrorResult } from "./tool-types";

export function formatToolSchemaError(
  message: string,
  code: string,
  error: z.ZodError,
): ToolErrorResult {
  return {
    error: true,
    message,
    code,
    details: error.issues.map((issue) => ({
      path: issue.path.length ? issue.path.join(".") : "(root)",
      message: issue.message,
    })),
  };
}

export function normalizeToolError(error: unknown): ToolErrorResult {
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred.";

  if (error instanceof ApiError) {
    const details =
      error.details && typeof error.details === "object" ? error.details : undefined;
    const code =
      error.code ??
      (details && "code" in details && typeof details.code === "string"
        ? details.code
        : undefined);

    return {
      error: true,
      message,
      ...(code ? { code } : {}),
      ...(error.details ? { details: error.details } : {}),
    };
  }

  return { error: true, message };
}
