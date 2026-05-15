import type { ErrorRequestHandler } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { env } from "../config/env";
import { serializeError, writeStructuredLog } from "../lib/structured-log";
import { ApiError, type ApiErrorCode } from "../utils/api-error";

export const errorHandler: ErrorRequestHandler = (
  error,
  req,
  res,
  _next,
) => {
  let statusCode = 500;
  let message = "Internal server error";
  let code: ApiErrorCode = "INTERNAL_ERROR";
  let details: unknown;

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.code;
    details = error.details;
  } else if (error instanceof MulterError) {
    statusCode = 400;
    code = error.code === "LIMIT_FILE_SIZE" ? "UPLOAD_FILE_TOO_LARGE" : "UPLOAD_FAILED";
    message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Evidence file exceeds the maximum allowed size."
        : "Evidence upload failed.";
  } else if (error instanceof ZodError) {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = "Validation failed";
    details = error.flatten();
  }

  if (statusCode >= 500) {
    writeStructuredLog({
      level: "error",
      type: "http_error",
      message: "Unhandled request error",
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode,
      ...(req.auth?.userId ? { userId: req.auth.userId } : {}),
      ...(req.auth?.tenantId ? { tenantId: req.auth.tenantId } : {}),
      error: serializeError(error),
    });
  }

  res.status(statusCode).json({
    success: false,
    code,
    message,
    requestId: req.requestId,
    ...(details ? { details } : {}),
    ...(env.NODE_ENV === "development" ? { stack: error.stack } : {}),
  });
};
