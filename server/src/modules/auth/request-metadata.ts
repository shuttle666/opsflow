import type { Request } from "express";
import type { RequestMetadata } from "../../types/auth";

export function getRequestMetadata(req: Request): RequestMetadata {
  return {
    ipAddress: req.ip ?? req.socket.remoteAddress,
    userAgent: req.headers["user-agent"],
  };
}
