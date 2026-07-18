import express from "express";
import request from "supertest";
import { errorHandler } from "../src/middleware/error-handler";
import {
  clearRateLimitBuckets,
  createRateLimiter,
} from "../src/middleware/rate-limit";
import { requestContext } from "../src/middleware/request-context";
import { getRequestMetadata } from "../src/modules/auth/request-metadata";

function createIpRateLimitedApp(trustProxyHops = 0) {
  const app = express();

  if (trustProxyHops > 0) {
    app.set("trust proxy", trustProxyHops);
  }

  app.use(requestContext);
  app.post(
    "/limited",
    createRateLimiter({
      windowMs: 60_000,
      maxRequests: 1,
      message: "Too many requests.",
    }),
    (req, res) => {
      res.json({
        requestIp: req.ip,
        metadata: getRequestMetadata(req),
      });
    },
  );
  app.use(errorHandler);

  return app;
}

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

  it("does not let a forged forwarded-for header change the bucket when proxies are untrusted", async () => {
    const app = createIpRateLimitedApp();

    const first = await request(app)
      .post("/limited")
      .set("X-Forwarded-For", "198.51.100.10")
      .send({});

    expect(first.status).toBe(200);
    expect(first.body.requestIp).not.toBe("198.51.100.10");
    expect(first.body.metadata.ipAddress).toBe(first.body.requestIp);

    const second = await request(app)
      .post("/limited")
      .set("X-Forwarded-For", "203.0.113.20")
      .send({});

    expect(second.status).toBe(429);
    expect(second.body).toMatchObject({ code: "RATE_LIMITED" });
  });

  it("uses the one-hop client address for limiting and request metadata", async () => {
    const app = createIpRateLimitedApp(1);

    const first = await request(app)
      .post("/limited")
      .set("X-Forwarded-For", "198.51.100.10, 203.0.113.20")
      .send({});

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      requestIp: "203.0.113.20",
      metadata: { ipAddress: "203.0.113.20" },
    });

    const forgedLeftmostAddress = await request(app)
      .post("/limited")
      .set("X-Forwarded-For", "192.0.2.99, 203.0.113.20")
      .send({});

    expect(forgedLeftmostAddress.status).toBe(429);
    expect(forgedLeftmostAddress.body).toMatchObject({ code: "RATE_LIMITED" });

    const differentClient = await request(app)
      .post("/limited")
      .set("X-Forwarded-For", "192.0.2.99, 203.0.113.21")
      .send({});

    expect(differentClient.status).toBe(200);
    expect(differentClient.body).toMatchObject({
      requestIp: "203.0.113.21",
      metadata: { ipAddress: "203.0.113.21" },
    });
  });

  it("wires the configured proxy hop into the real authentication limiter", async () => {
    const previousTrustProxyHops = process.env.TRUST_PROXY_HOPS;
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      process.env.TRUST_PROXY_HOPS = "1";
      vi.resetModules();
      const { app } = await import("../src/app");

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const response = await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", `192.0.2.${attempt + 1}, 203.0.113.30`)
          .send({});
        expect(response.status).toBe(400);
      }

      const forgedAddressRotation = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", "198.51.100.99, 203.0.113.30")
        .send({});
      expect(forgedAddressRotation.status).toBe(429);

      const differentClient = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", "198.51.100.99, 203.0.113.31")
        .send({});
      expect(differentClient.status).toBe(400);
    } finally {
      if (previousTrustProxyHops === undefined) {
        delete process.env.TRUST_PROXY_HOPS;
      } else {
        process.env.TRUST_PROXY_HOPS = previousTrustProxyHops;
      }
      vi.resetModules();
      infoSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
