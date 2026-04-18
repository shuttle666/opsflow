import type { Request, Response } from "express";
import type { AuthContext } from "../../types/auth";
import type { NotificationItem } from "./notification.service";

type NotificationStreamEvent =
  | {
      type: "notification";
      notification: NotificationItem;
      unreadCount: number;
    }
  | {
      type: "unread_count";
      unreadCount: number;
    }
  | {
      type: "heartbeat";
    };

type StreamClient = {
  key: string;
  res: Response;
  heartbeat: NodeJS.Timeout;
};

const clientsByKey = new Map<string, Set<StreamClient>>();

function streamKey(tenantId: string, userId: string) {
  return `${tenantId}:${userId}`;
}

function writeStreamEvent(res: Response, event: NotificationStreamEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function removeClient(client: StreamClient) {
  clearInterval(client.heartbeat);

  const clients = clientsByKey.get(client.key);
  if (!clients) {
    return;
  }

  clients.delete(client);
  if (clients.size === 0) {
    clientsByKey.delete(client.key);
  }
}

export function subscribeNotificationStream(
  auth: AuthContext,
  req: Request,
  res: Response,
  unreadCount: number,
) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  const client: StreamClient = {
    key: streamKey(auth.tenantId, auth.userId),
    res,
    heartbeat: setInterval(() => {
      writeStreamEvent(res, { type: "heartbeat" });
    }, 25_000),
  };

  const clients = clientsByKey.get(client.key) ?? new Set<StreamClient>();
  clients.add(client);
  clientsByKey.set(client.key, clients);

  writeStreamEvent(res, { type: "unread_count", unreadCount });

  req.on("close", () => {
    removeClient(client);
  });
}

export function publishNotification(
  tenantId: string,
  userId: string,
  notification: NotificationItem,
  unreadCount: number,
) {
  const clients = clientsByKey.get(streamKey(tenantId, userId));
  if (!clients) {
    return;
  }

  for (const client of clients) {
    try {
      writeStreamEvent(client.res, {
        type: "notification",
        notification,
        unreadCount,
      });
    } catch {
      removeClient(client);
    }
  }
}

export function publishUnreadCount(
  tenantId: string,
  userId: string,
  unreadCount: number,
) {
  const clients = clientsByKey.get(streamKey(tenantId, userId));
  if (!clients) {
    return;
  }

  for (const client of clients) {
    try {
      writeStreamEvent(client.res, {
        type: "unread_count",
        unreadCount,
      });
    } catch {
      removeClient(client);
    }
  }
}
