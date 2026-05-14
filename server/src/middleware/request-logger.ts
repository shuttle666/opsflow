import type { RequestHandler } from "express";
import { writeStructuredLog } from "../lib/structured-log";

function levelForStatus(statusCode: number) {
  if (statusCode >= 500) {
    return "error";
  }

  if (statusCode >= 400) {
    return "warn";
  }

  return "info";
}

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    writeStructuredLog({
      level: levelForStatus(res.statusCode),
      type: "http_request",
      message: `${req.method} ${req.originalUrl} completed with ${res.statusCode}`,
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      ...(req.auth?.userId ? { userId: req.auth.userId } : {}),
      ...(req.auth?.tenantId ? { tenantId: req.auth.tenantId } : {}),
    });
  });

  next();
};
