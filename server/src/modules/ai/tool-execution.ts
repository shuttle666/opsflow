import { z } from "zod";
import { ApiError } from "../../utils/api-error";

export type AiToolErrorResult = {
  error: true;
  message: string;
  code?: string;
  details?: unknown;
};

export function normalizeAiToolError(error: unknown): AiToolErrorResult {
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred.";

  if (error instanceof ApiError) {
    const details =
      error.details && typeof error.details === "object" ? error.details : undefined;
    const code =
      details && "code" in details && typeof details.code === "string"
        ? details.code
        : undefined;

    return {
      error: true,
      message,
      ...(code ? { code } : {}),
      ...(error.details ? { details: error.details } : {}),
    };
  }

  return { error: true, message };
}

export function formatToolValidationError(error: z.ZodError): AiToolErrorResult {
  return {
    error: true,
    message: "Tool input validation failed.",
    code: "TOOL_INPUT_VALIDATION_FAILED",
    details: error.issues.map((issue) => ({
      path: issue.path.length ? issue.path.join(".") : "(root)",
      message: issue.message,
    })),
  };
}

export async function safeExecute(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    return await fn();
  } catch (error) {
    return normalizeAiToolError(error);
  }
}

export async function safeExecuteWithSchema<T>(
  schema: z.ZodType<T>,
  input: Record<string, unknown>,
  fn: (validatedInput: T) => Promise<unknown>,
): Promise<unknown> {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    return formatToolValidationError(parsed.error);
  }

  return safeExecute(() => fn(parsed.data));
}

