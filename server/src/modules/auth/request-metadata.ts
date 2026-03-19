import type { Request } from "express";
import type { RequestMetadata } from "../../types/auth";

export function getRequestMetadata(req: Request): RequestMetadata {
  const forwardedFor = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0]?.trim();

  return {
    ipAddress: forwardedIp ?? req.ip,
    userAgent: req.headers["user-agent"],
  };
}

