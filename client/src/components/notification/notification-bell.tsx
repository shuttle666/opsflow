"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, CheckCircle2 } from "@/components/ui/icons";
import { cn, subtleButtonClassName } from "@/components/ui/styles";
import {
  consumeNotificationStream,
  getUnreadNotificationCountRequest,
  listNotificationsRequest,
  markAllNotificationsReadRequest,
  markNotificationReadRequest,
  openNotificationStreamRequest,
} from "@/features/notification";
import { useAuthStore } from "@/store/auth-store";
import type { NotificationItem } from "@/types/notification";

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString();
}

function targetHref(notification: NotificationItem) {
  if (notification.targetType === "job" && notification.targetId) {
    return `/jobs/${notification.targetId}`;
  }

  return null;
}

function mergeNotification(
  current: NotificationItem[],
  notification: NotificationItem,
) {
  return [
    notification,
    ...current.filter((item) => item.id !== notification.id),
  ].slice(0, 10);
}

export function NotificationBell() {
  const status = useAuthStore((state) => state.status);
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const loadNotifications = useCallback(async () => {
    if (status !== "authenticated" || !currentTenant) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await withAccessTokenRetry((accessToken) =>
        listNotificationsRequest(accessToken, {
          page: 1,
          pageSize: 10,
          status: "all",
        }),
      );
      setItems(result.items);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load notifications.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant, status, withAccessTokenRetry]);

  useEffect(() => {
    if (isOpen) {
      void loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  useEffect(() => {
    setItems([]);
    setUnreadCount(0);
    setError(null);
  }, [currentTenant?.tenantId]);

  useEffect(() => {
    if (
      process.env.NODE_ENV === "test" ||
      status !== "authenticated" ||
      !currentTenant
    ) {
      return;
    }

    let cancelled = false;
    let controller: AbortController | null = null;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = async () => {
      clearReconnectTimer();
      controller = new AbortController();

      try {
        const count = await withAccessTokenRetry((accessToken) =>
          getUnreadNotificationCountRequest(accessToken),
        );
        if (!cancelled) {
          setUnreadCount(count.unreadCount);
        }

        const response = await withAccessTokenRetry((accessToken) =>
          openNotificationStreamRequest(accessToken, controller?.signal),
        );

        await consumeNotificationStream(response, {
          onNotification: (notification, nextUnreadCount) => {
            if (cancelled) {
              return;
            }
            setUnreadCount(nextUnreadCount);
            setItems((current) => mergeNotification(current, notification));
          },
          onUnreadCount: (nextUnreadCount) => {
            if (!cancelled) {
              setUnreadCount(nextUnreadCount);
            }
          },
          onError: (message) => {
            if (!cancelled && isOpenRef.current) {
              setError(message);
            }
          },
        });
      } catch (streamError) {
        if (
          !cancelled &&
          (streamError as Error).name !== "AbortError" &&
          isOpenRef.current
        ) {
          setError(
            streamError instanceof Error
              ? streamError.message
              : "Notification stream failed.",
          );
        }
      } finally {
        if (!cancelled) {
          reconnectTimerRef.current = setTimeout(() => {
            void connect();
          }, 5_000);
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      controller?.abort();
      clearReconnectTimer();
    };
  }, [currentTenant, status, withAccessTokenRetry]);

  const handleMarkRead = async (notification: NotificationItem) => {
    const wasUnread = !notification.readAt;
    setError(null);

    try {
      const updated = await withAccessTokenRetry((accessToken) =>
        markNotificationReadRequest(accessToken, notification.id),
      );
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      if (wasUnread) {
        setUnreadCount((current) => Math.max(0, current - 1));
      }
    } catch (markError) {
      setError(
        markError instanceof Error
          ? markError.message
          : "Failed to mark notification as read.",
      );
    }
  };

  const handleMarkAllRead = async () => {
    setError(null);

    try {
      await withAccessTokenRetry((accessToken) =>
        markAllNotificationsReadRequest(accessToken),
      );
      const readAt = new Date().toISOString();
      setItems((current) =>
        current.map((item) => ({
          ...item,
          readAt: item.readAt ?? readAt,
        })),
      );
      setUnreadCount(0);
    } catch (markError) {
      setError(
        markError instanceof Error
          ? markError.message
          : "Failed to mark notifications as read.",
      );
    }
  };

  const hasUnread = unreadCount > 0;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] shadow-sm transition hover:bg-[var(--color-app-panel-muted)]"
      >
        {hasUnread ? (
          <BellRing className="h-5 w-5 text-[var(--color-brand)]" />
        ) : (
          <Bell className="h-5 w-5 text-[var(--color-text-secondary)]" />
        )}
        {hasUnread ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] shadow-[var(--shadow-floating)]">
          <div className="flex items-center justify-between border-b border-[var(--color-app-border)] px-4 py-3">
            <div>
              <p className="text-sm font-bold text-[var(--color-text)]">Notifications</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {hasUnread ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
            <button
              type="button"
              disabled={!hasUnread}
              onClick={handleMarkAllRead}
              className={cn(subtleButtonClassName, "h-8 px-3 text-xs")}
            >
              <CheckCircle2 className="h-4 w-4" />
              Read all
            </button>
          </div>

          {error ? (
            <div className="border-b border-[var(--color-app-border)] bg-[var(--color-danger-soft)] px-4 py-3 text-xs text-[var(--color-danger)]">
              {error}
            </div>
          ) : null}

          <div className="max-h-[420px] overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                Loading notifications...
              </div>
            ) : null}

            {!isLoading && items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-semibold text-[var(--color-text)]">No notifications</p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Work updates will arrive here.
                </p>
              </div>
            ) : null}

            {!isLoading
              ? items.map((notification) => {
                  const href = targetHref(notification);
                  const unread = !notification.readAt;
                  const content = (
                    <div
                      className={cn(
                        "block border-b border-[var(--color-app-border)] px-4 py-3 text-left transition hover:bg-[var(--color-app-panel-muted)]",
                        unread ? "bg-[var(--color-brand-soft)]" : "bg-[var(--color-app-panel)]",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "mt-1 h-2 w-2 shrink-0 rounded-full",
                            unread ? "bg-[var(--color-brand)]" : "bg-[var(--color-app-border-strong)]",
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-[var(--color-text)]">
                            {notification.title}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-[var(--color-text-secondary)]">
                            {notification.body}
                          </span>
                          <span className="mt-2 block text-[11px] font-medium text-[var(--color-text-muted)]">
                            {formatTimestamp(notification.createdAt)}
                          </span>
                        </span>
                      </div>
                    </div>
                  );

                  return href ? (
                    <Link
                      key={notification.id}
                      href={href}
                      onClick={() => {
                        setIsOpen(false);
                        void handleMarkRead(notification);
                      }}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => void handleMarkRead(notification)}
                      className="w-full"
                    >
                      {content}
                    </button>
                  );
                })
              : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
