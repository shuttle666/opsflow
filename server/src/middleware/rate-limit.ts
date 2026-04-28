import type { RequestHandler } from "express";
import { ApiError } from "../utils/api-error";

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  message: string;
  keyGenerator?: (req: Parameters<RequestHandler>[0]) => string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const maxBucketCount = 10_000;

function clientIp(req: Parameters<RequestHandler>[0]) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function defaultKey(req: Parameters<RequestHandler>[0]) {
  return clientIp(req);
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const keyGenerator = options.keyGenerator ?? defaultKey;

  return (req, res, next) => {
    const now = Date.now();
    if (buckets.size > maxBucketCount) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) {
          buckets.delete(bucketKey);
        }
      }
    }

    const key = keyGenerator(req);
    const existing = buckets.get(key);
    const bucket =
      existing && existing.resetAt > now
        ? existing
        : { count: 0, resetAt: now + options.windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    res.setHeader(
      "RateLimit-Reset",
      String(Math.ceil((bucket.resetAt - now) / 1000)),
    );

    if (bucket.count > options.maxRequests) {
      next(new ApiError(429, options.message));
      return;
    }

    next();
  };
}

export function emailAndIpRateLimitKey(req: Parameters<RequestHandler>[0]) {
  const email =
    typeof req.body === "object" &&
    req.body &&
    "email" in req.body &&
    typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "unknown";

  return `${clientIp(req)}:${email}`;
}
