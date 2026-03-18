import request from "supertest";
import { createApp } from "../src/app";

describe("GET /api/health", () => {
  it("returns API health payload", async () => {
    const app = createApp();
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "OpsFlow API is healthy.",
      data: {
        status: "ok",
      },
    });
    expect(typeof response.body.data.timestamp).toBe("string");
  });
});

