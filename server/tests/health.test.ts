import request from "supertest";
import { createApp } from "../src/app";

describe("GET /api/health", () => {
  it("returns API health payload", async () => {
    const app = createApp();
    const response = await request(app).get("/api/health");
    const requestId = response.headers["x-request-id"];

    expect(response.status).toBe(200);
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(response.body).toMatchObject({
      success: true,
      message: "OpsFlow API is healthy.",
      data: {
        status: "ok",
      },
    });
    expect(typeof response.body.data.timestamp).toBe("string");
  });

  it("preserves a safe incoming request id", async () => {
    const app = createApp();
    const response = await request(app)
      .get("/api/health")
      .set("X-Request-Id", "client-request-123");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe("client-request-123");
  });

  it("replaces an unsafe incoming request id", async () => {
    const app = createApp();
    const response = await request(app)
      .get("/api/health")
      .set("X-Request-Id", "bad request id");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).not.toBe("bad request id");
    expect(response.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("returns the request id in error responses", async () => {
    const app = createApp();
    const response = await request(app)
      .get("/api/missing")
      .set("X-Request-Id", "client-request-404");

    expect(response.status).toBe(404);
    expect(response.headers["x-request-id"]).toBe("client-request-404");
    expect(response.body).toMatchObject({
      success: false,
      requestId: "client-request-404",
      message: "Route GET /api/missing not found.",
    });
  });
});
