import { describe, expect, it, vi } from "vitest";
import { consumeNotificationStream } from "./notification-api";

describe("consumeNotificationStream", () => {
  it("parses notification and unread count events from an SSE response", async () => {
    const onNotification = vi.fn();
    const onUnreadCount = vi.fn();
    const onError = vi.fn();
    const payload = [
      `data: ${JSON.stringify({ type: "unread_count", unreadCount: 2 })}`,
      "",
      `data: ${JSON.stringify({
        type: "notification",
        unreadCount: 3,
        notification: {
          id: "notification-1",
          type: "JOB_ASSIGNED",
          title: "Job assigned",
          body: "You have been assigned to Test Job.",
          metadata: null,
          readAt: null,
          createdAt: "2026-04-19T00:00:00.000Z",
        },
      })}`,
      "",
      `data: ${JSON.stringify({ type: "heartbeat" })}`,
      "",
    ].join("\n");

    await consumeNotificationStream(new Response(payload), {
      onNotification,
      onUnreadCount,
      onError,
    });

    expect(onUnreadCount).toHaveBeenCalledWith(2);
    expect(onNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "notification-1",
        type: "JOB_ASSIGNED",
      }),
      3,
    );
    expect(onError).not.toHaveBeenCalled();
  });
});
