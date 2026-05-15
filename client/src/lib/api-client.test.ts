import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient, ApiClientError, getApiErrorView } from "@/lib/api-client";

describe("apiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the request id from an error response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            requestId: "request-from-body",
          }),
          {
            status: 400,
            headers: {
              "content-type": "application/json",
              "x-request-id": "request-from-header",
            },
          },
        ),
      ),
    );

    await expect(apiClient.get("/jobs")).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      requestId: "request-from-body",
    });
  });

  it("falls back to the response header request id when the body omits it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            code: "INTERNAL_ERROR",
            message: "Internal server error",
          }),
          {
            status: 500,
            headers: {
              "content-type": "application/json",
              "x-request-id": "request-from-header",
            },
          },
        ),
      ),
    );

    await expect(apiClient.get("/jobs")).rejects.toMatchObject({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Internal server error",
      requestId: "request-from-header",
    });
  });

  it("keeps request ids on blob error responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            code: "EVIDENCE_NOT_FOUND",
            message: "Evidence file was not found.",
            requestId: "blob-error-request",
          }),
          {
            status: 404,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      ),
    );

    await expect(apiClient.getBlob("/jobs/job-1/evidence/evidence-1")).rejects.toMatchObject({
      status: 404,
      code: "EVIDENCE_NOT_FOUND",
      message: "Evidence file was not found.",
      requestId: "blob-error-request",
    });
  });
});

describe("getApiErrorView", () => {
  it("prefers local fallback copy for generic backend errors while keeping request id", () => {
    expect(
      getApiErrorView(
        new ApiClientError(400, "Validation failed", undefined, "request-123"),
        "Failed to create job.",
      ),
    ).toEqual({
      message: "Failed to create job.",
      requestId: "request-123",
    });
  });

  it("keeps specific backend messages", () => {
    expect(
      getApiErrorView(
        new ApiClientError(404, "Customer was not found.", undefined, "request-456"),
        "Failed to load customer.",
      ),
    ).toEqual({
      message: "Customer was not found.",
      requestId: "request-456",
    });
  });
});
