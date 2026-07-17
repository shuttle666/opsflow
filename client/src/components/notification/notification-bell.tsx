"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, CheckCircle2 } from "@/components/ui/icons";
import { cn, subtleButtonClassName } from "@/components/ui/styles";
import {
  consumeNotificationStream,
  openNotificationStreamRequest,
} from "@/features/notification/notification-api";
import {
  notificationPreviewQuery,
  type NotificationListResult,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
  useUnreadNotificationCountQuery,
} from "@/features/notification/notification-queries";
import {
  useAuthenticatedQueryScope,
} from "@/hooks/use-authenticated-query";
import { queryKeys } from "@/lib/query-keys";
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
  const queryClient = useQueryClient();
  const { tenantId, userId, role } = useAuthenticatedQueryScope();
  const [isOpen, setIsOpen] = useState(false);
  const [streamError, setStreamError] = useState<{
    tenantId: string | null;
    message: string;
  } | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpenRef = useRef(isOpen);
  const notificationsQuery = useNotificationsQuery(
    notificationPreviewQuery,
    isOpen,
  );
  const unreadCountQuery = useUnreadNotificationCountQuery();
  const markReadMutation = useMarkNotificationReadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation();
  const items = notificationsQuery.data?.items ?? [];
  const unreadCount = unreadCountQuery.data?.unreadCount ?? 0;
  const isLoading = notificationsQuery.isPending;
  const error =
    markReadMutation.error?.message ??
    markAllReadMutation.error?.message ??
    notificationsQuery.error?.message ??
    unreadCountQuery.error?.message ??
    (streamError?.tenantId === (tenantId ?? null)
      ? streamError.message
      : null);

  isOpenRef.current = isOpen;

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
        const response = await withAccessTokenRetry((accessToken) =>
          openNotificationStreamRequest(accessToken, controller?.signal),
        );

        await consumeNotificationStream(response, {
          onNotification: (notification, nextUnreadCount) => {
            if (cancelled) {
              return;
            }
            const scope = { tenantId, userId, role };
            queryClient.setQueryData(
              queryKeys.notifications.unreadCount(scope),
              { unreadCount: nextUnreadCount },
            );
            queryClient.setQueryData<NotificationListResult>(
              queryKeys.notifications.list(scope, notificationPreviewQuery),
              (current) =>
                current
                  ? {
                      ...current,
                      items: mergeNotification(current.items, notification),
                    }
                  : current,
            );
          },
          onUnreadCount: (nextUnreadCount) => {
            if (!cancelled) {
              queryClient.setQueryData(
                queryKeys.notifications.unreadCount({ tenantId, userId, role }),
                { unreadCount: nextUnreadCount },
              );
            }
          },
          onError: (message) => {
            if (!cancelled && isOpenRef.current) {
              setStreamError({ tenantId: tenantId ?? null, message });
            }
          },
        });
      } catch (streamError) {
        if (
          !cancelled &&
          (streamError as Error).name !== "AbortError" &&
          isOpenRef.current
        ) {
          setStreamError({
            tenantId: tenantId ?? null,
            message:
              streamError instanceof Error
                ? streamError.message
                : "Notification stream failed.",
          });
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
  }, [
    currentTenant,
    queryClient,
    role,
    status,
    tenantId,
    userId,
    withAccessTokenRetry,
  ]);

  const handleMarkRead = (notification: NotificationItem) => {
    markReadMutation.mutate(notification);
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate();
  };

  const hasUnread = unreadCount > 0;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen((current) => !current);
          setStreamError(null);
          markReadMutation.reset();
          markAllReadMutation.reset();
        }}
        className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] shadow-sm transition hover:bg-[var(--color-app-panel-muted)] md:h-9 md:w-9"
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
        <div className="fixed inset-x-4 top-16 z-50 overflow-hidden rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] shadow-[var(--shadow-floating)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[min(360px,calc(100vw-2rem))]">
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
              className={cn(subtleButtonClassName, "px-3 text-xs md:min-h-8")}
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

          <div className="max-h-[calc(100dvh-13rem)] overflow-y-auto sm:max-h-[420px]">
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
                        handleMarkRead(notification);
                      }}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => handleMarkRead(notification)}
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
