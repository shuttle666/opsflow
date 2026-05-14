import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const requestIdPattern = /^[a-zA-Z0-9._:-]{8,128}$/;

function normalizeRequestId(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;

  if (typeof raw !== "string") {
    return undefined;
  }

  const trimmed = raw.trim();
  return requestIdPattern.test(trimmed) ? trimmed : undefined;
}

export const requestContext: RequestHandler = (req, res, next) => {
  const requestId =
    normalizeRequestId(req.headers["x-request-id"]) ?? randomUUID();

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  next();
};
