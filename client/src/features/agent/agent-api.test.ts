import { describe, expect, it, vi } from "vitest";
import { consumeMessageStream } from "./agent-api";

describe("consumeMessageStream", () => {
  it("preserves the request ID from an SSE error event", async () => {
    const onError = vi.fn();
    const onDone = vi.fn();
    const payload = [
      `data: ${JSON.stringify({
        type: "error",
        message: "AI provider unavailable",
        requestId: "web-agent-request-123",
      })}`,
      "",
      `data: ${JSON.stringify({ type: "done" })}`,
      "",
    ].join("\n");

    await consumeMessageStream(new Response(payload), {
      onTextDelta: vi.fn(),
      onToolUse: vi.fn(),
      onToolResult: vi.fn(),
      onError,
      onDone,
    });

    expect(onError).toHaveBeenCalledWith({
      message: "AI provider unavailable",
      requestId: "web-agent-request-123",
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("uses the response request ID for tool results and SSE errors without one", async () => {
    const onToolResult = vi.fn();
    const onError = vi.fn();
    const payload = [
      `data: ${JSON.stringify({
        type: "tool_result",
        tool: "execute_proposal",
        result: { error: true, message: "Execution failed" },
      })}`,
      "",
      `data: ${JSON.stringify({
        type: "error",
        message: "Stream failed",
      })}`,
      "",
      `data: ${JSON.stringify({ type: "done" })}`,
      "",
    ].join("\n");

    await consumeMessageStream(
      new Response(payload, {
        headers: { "X-Request-Id": "response-request-123" },
      }),
      {
        onTextDelta: vi.fn(),
        onToolUse: vi.fn(),
        onToolResult,
        onError,
        onDone: vi.fn(),
      },
    );

    expect(onToolResult).toHaveBeenCalledWith(
      "execute_proposal",
      { error: true, message: "Execution failed" },
      "response-request-123",
    );
    expect(onError).toHaveBeenCalledWith({
      message: "Stream failed",
      requestId: "response-request-123",
    });
  });

  it("keeps the response request ID when the stream cannot be read", async () => {
    const onError = vi.fn();

    await consumeMessageStream(
      new Response(null, {
        headers: { "X-Request-Id": "empty-stream-request-123" },
      }),
      {
        onTextDelta: vi.fn(),
        onToolUse: vi.fn(),
        onToolResult: vi.fn(),
        onError,
        onDone: vi.fn(),
      },
    );

    expect(onError).toHaveBeenCalledWith({
      message: "No response body.",
      requestId: "empty-stream-request-123",
    });
  });

  it("keeps the response request ID when reading the stream fails", async () => {
    const onError = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("Stream disconnected"));
      },
    });

    await consumeMessageStream(
      new Response(body, {
        headers: { "X-Request-Id": "disconnected-request-123" },
      }),
      {
        onTextDelta: vi.fn(),
        onToolUse: vi.fn(),
        onToolResult: vi.fn(),
        onError,
        onDone: vi.fn(),
      },
    );

    expect(onError).toHaveBeenCalledWith({
      message: "Stream disconnected",
      requestId: "disconnected-request-123",
    });
  });
});
