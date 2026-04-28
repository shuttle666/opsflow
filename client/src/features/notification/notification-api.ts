import {
  ApiClientError,
  apiClient,
  type ApiSuccessResponse,
} from "@/lib/api-client";
import type { PaginationMeta } from "@/types/customer";
import type {
  NotificationItem,
  NotificationStreamEvent,
} from "@/types/notification";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

function authHeader(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function requireData<T>(response: ApiSuccessResponse<T>, fallbackMessage: string) {
  if (response.data === undefined) {
    throw new Error(fallbackMessage);
  }

  return response.data;
}

export async function listNotificationsRequest(
  accessToken: string,
  query: {
    page?: number;
    pageSize?: number;
    status?: "all" | "unread";
  } = {},
) {
  const params = new URLSearchParams();

  if (query.page) {
    params.set("page", String(query.page));
  }
  if (query.pageSize) {
    params.set("pageSize", String(query.pageSize));
  }
  if (query.status) {
    params.set("status", query.status);
  }

  const serialized = params.toString();
  const response = await apiClient.get<ApiSuccessResponse<NotificationItem[]>>(
    `/notifications${serialized ? `?${serialized}` : ""}`,
    {
      headers: authHeader(accessToken),
    },
  );

  return {
    items: requireData(response, "Notifications response is missing payload."),
    pagination: ((response.meta as { pagination?: PaginationMeta } | undefined)
      ?.pagination ?? {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      total: 0,
      totalPages: 1,
    }) satisfies PaginationMeta,
  };
}

export async function getUnreadNotificationCountRequest(accessToken: string) {
  const response = await apiClient.get<ApiSuccessResponse<{ unreadCount: number }>>(
    "/notifications/unread-count",
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Unread notification count response is missing payload.");
}

export async function markNotificationReadRequest(
  accessToken: string,
  notificationId: string,
) {
  const response = await apiClient.patch<ApiSuccessResponse<NotificationItem>>(
    `/notifications/${notificationId}/read`,
    undefined,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Mark notification read response is missing payload.");
}

export async function markAllNotificationsReadRequest(accessToken: string) {
  const response = await apiClient.post<ApiSuccessResponse<{ updatedCount: number }>>(
    "/notifications/read-all",
    undefined,
    {
      headers: authHeader(accessToken),
    },
  );

  return requireData(response, "Mark all notifications read response is missing payload.");
}

export async function openNotificationStreamRequest(
  accessToken: string,
  signal?: AbortSignal,
): Promise<Response> {
  const response = await fetch(`${API_BASE_URL}/notifications/stream`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
    signal,
  });

  if (response.ok) {
    return response;
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => undefined) : undefined;
  const errorPayload = payload as { message?: string; details?: unknown } | undefined;
  const text = isJson ? "" : await response.text().catch(() => "");
  const fallbackMessage =
    text.trim() || `API request failed with status ${response.status}`;

  throw new ApiClientError(
    response.status,
    errorPayload?.message ?? fallbackMessage,
    errorPayload?.details,
  );
}

type NotificationStreamCallbacks = {
  onNotification: (notification: NotificationItem, unreadCount: number) => void;
  onUnreadCount: (unreadCount: number) => void;
  onError: (message: string) => void;
};

export async function consumeNotificationStream(
  response: Response,
  callbacks: NotificationStreamCallbacks,
): Promise<void> {
  try {
    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError("No response body.");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) {
          continue;
        }

        try {
          const event = JSON.parse(line.slice(6)) as NotificationStreamEvent;

          switch (event.type) {
            case "notification":
              callbacks.onNotification(event.notification, event.unreadCount);
              break;
            case "unread_count":
              callbacks.onUnreadCount(event.unreadCount);
              break;
            case "heartbeat":
              break;
          }
        } catch {
          // Skip malformed stream lines.
        }
      }
    }
  } catch (error) {
    if ((error as Error).name !== "AbortError") {
      callbacks.onError((error as Error).message ?? "Notification stream failed.");
    }
  }
}
