export type NotificationType =
  | "JOB_ASSIGNED"
  | "JOB_UNASSIGNED"
  | "JOB_STATUS_CHANGED"
  | "JOB_COMPLETION_SUBMITTED"
  | "JOB_COMPLETION_APPROVED"
  | "JOB_COMPLETION_RETURNED";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  targetType?: string;
  targetId?: string;
  metadata: unknown;
  readAt: string | null;
  createdAt: string;
  actor?: {
    id: string;
    displayName: string;
    email: string;
  };
};

export type NotificationPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type NotificationStreamEvent =
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
