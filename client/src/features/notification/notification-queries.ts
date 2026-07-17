import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  useAuthenticatedMutation,
  useAuthenticatedQuery,
  useAuthenticatedQueryScope,
} from "@/hooks/use-authenticated-query";
import { queryKeys, type QueryScope } from "@/lib/query-keys";
import type { NotificationItem } from "@/types/notification";
import {
  getUnreadNotificationCountRequest,
  listNotificationsRequest,
  markAllNotificationsReadRequest,
  markNotificationReadRequest,
} from "./notification-api";

export type NotificationListQuery = {
  page?: number;
  pageSize?: number;
  status?: "all" | "unread";
};

export type NotificationListResult = Awaited<
  ReturnType<typeof listNotificationsRequest>
>;

export const notificationPreviewQuery = {
  page: 1,
  pageSize: 10,
  status: "all",
} as const satisfies NotificationListQuery;

function updateNotificationLists(
  queryClient: QueryClient,
  scope: QueryScope,
  updater: (current: NotificationItem[]) => NotificationItem[],
) {
  queryClient.setQueriesData<NotificationListResult>(
    { queryKey: queryKeys.notifications.lists(scope) },
    (current) =>
      current
        ? {
            ...current,
            items: updater(current.items),
          }
        : current,
  );
}

export function useNotificationsQuery(
  query: NotificationListQuery,
  enabled = true,
) {
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedQuery({
    queryKey: queryKeys.notifications.list(scope, query),
    queryFn: (accessToken) => listNotificationsRequest(accessToken, query),
    enabled: enabled && Boolean(scope.tenantId && scope.userId),
  });
}

export function useUnreadNotificationCountQuery(enabled = true) {
  const scope = useAuthenticatedQueryScope();

  return useAuthenticatedQuery({
    queryKey: queryKeys.notifications.unreadCount(scope),
    queryFn: getUnreadNotificationCountRequest,
    enabled: enabled && Boolean(scope.tenantId && scope.userId),
  });
}

export function useMarkNotificationReadMutation() {
  const scope = useAuthenticatedQueryScope();
  const queryClient = useQueryClient();

  return useAuthenticatedMutation({
    mutationFn: (accessToken, notification: NotificationItem) =>
      markNotificationReadRequest(accessToken, notification.id),
    onSuccess: (updated, notification) => {
      updateNotificationLists(queryClient, scope, (current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );

      if (!notification.readAt) {
        queryClient.setQueryData<{ unreadCount: number }>(
          queryKeys.notifications.unreadCount(scope),
          (current) => ({
            unreadCount: Math.max(0, (current?.unreadCount ?? 1) - 1),
          }),
        );
      }
    },
  });
}

export function useMarkAllNotificationsReadMutation() {
  const scope = useAuthenticatedQueryScope();
  const queryClient = useQueryClient();

  return useAuthenticatedMutation({
    mutationFn: (accessToken) => markAllNotificationsReadRequest(accessToken),
    onSuccess: () => {
      const readAt = new Date().toISOString();
      updateNotificationLists(queryClient, scope, (current) =>
        current.map((item) => ({
          ...item,
          readAt: item.readAt ?? readAt,
        })),
      );
      queryClient.setQueryData(
        queryKeys.notifications.unreadCount(scope),
        { unreadCount: 0 },
      );
    },
  });
}
