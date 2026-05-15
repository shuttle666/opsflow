import express from "express";
import request from "supertest";
import { errorHandler } from "../src/middleware/error-handler";
import {
  clearRateLimitBuckets,
  createRateLimiter,
} from "../src/middleware/rate-limit";
import { requestContext } from "../src/middleware/request-context";

describe("rate limiter", () => {
  beforeEach(() => {
    clearRateLimitBuckets();
  });

  it("returns a stable error code, request id, and rate limit headers", async () => {
    const app = express();

    app.use(requestContext);
    app.post(
      "/limited",
      createRateLimiter({
        windowMs: 60_000,
        maxRequests: 1,
        message: "Too many requests.",
      }),
      (_req, res) => {
        res.json({ success: true });
      },
    );
    app.use(errorHandler);

    const first = await request(app)
      .post("/limited")
      .set("X-Request-Id", "rate-limit-request")
      .send({});
    expect(first.status).toBe(200);
    expect(first.headers["ratelimit-limit"]).toBe("1");
    expect(first.headers["ratelimit-remaining"]).toBe("0");

    const second = await request(app)
      .post("/limited")
      .set("X-Request-Id", "rate-limit-request")
      .send({});

    expect(second.status).toBe(429);
    expect(second.headers["ratelimit-limit"]).toBe("1");
    expect(second.headers["ratelimit-remaining"]).toBe("0");
    expect(second.headers["ratelimit-reset"]).toBeDefined();
    expect(second.body).toMatchObject({
      success: false,
      code: "RATE_LIMITED",
      message: "Too many requests.",
      requestId: "rate-limit-request",
    });
  });
});
