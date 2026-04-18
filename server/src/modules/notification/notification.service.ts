import {
  MembershipRole,
  MembershipStatus,
  NotificationType,
  type Prisma,
} from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import type { AuthContext } from "../../types/auth";
import { ApiError } from "../../utils/api-error";
import type { NotificationListQueryInput } from "./notification-schemas";
import {
  publishNotification,
  publishUnreadCount,
  subscribeNotificationStream,
} from "./notification-broker";

const notificationSelect = {
  id: true,
  tenantId: true,
  recipientUserId: true,
  actorUserId: true,
  type: true,
  title: true,
  body: true,
  targetType: true,
  targetId: true,
  metadata: true,
  readAt: true,
  createdAt: true,
  actor: {
    select: {
      id: true,
      displayName: true,
      email: true,
    },
  },
} satisfies Prisma.NotificationSelect;

type SelectedNotification = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  targetType?: string;
  targetId?: string;
  metadata: Prisma.JsonValue | null;
  readAt: Date | null;
  createdAt: Date;
  actor?: {
    id: string;
    displayName: string;
    email: string;
  };
};

export type NotificationDeliveryItem = NotificationItem & {
  tenantId: string;
  recipientUserId: string;
};

type NotificationListResult = {
  items: NotificationItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type CreateNotificationRecordInput = {
  tenantId: string;
  recipientUserId: string;
  actorUserId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
};

function mapNotification(notification: SelectedNotification): NotificationDeliveryItem {
  return {
    id: notification.id,
    tenantId: notification.tenantId,
    recipientUserId: notification.recipientUserId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    ...(notification.targetType ? { targetType: notification.targetType } : {}),
    ...(notification.targetId ? { targetId: notification.targetId } : {}),
    metadata: notification.metadata,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
    ...(notification.actor ? { actor: notification.actor } : {}),
  };
}

function publicNotification(notification: NotificationDeliveryItem): NotificationItem {
  const { tenantId: _tenantId, recipientUserId: _recipientUserId, ...item } = notification;
  return item;
}

function displayStatus(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function unreadCountFor(tenantId: string, recipientUserId: string) {
  return prisma.notification.count({
    where: {
      tenantId,
      recipientUserId,
      readAt: null,
    },
  });
}

async function publishUnreadCountFor(tenantId: string, recipientUserId: string) {
  const unreadCount = await unreadCountFor(tenantId, recipientUserId);
  publishUnreadCount(tenantId, recipientUserId, unreadCount);
  return unreadCount;
}

export async function publishCreatedNotifications(
  notifications: NotificationDeliveryItem[],
) {
  await Promise.all(
    notifications.map(async (notification) => {
      const unreadCount = await unreadCountFor(
        notification.tenantId,
        notification.recipientUserId,
      );
      publishNotification(
        notification.tenantId,
        notification.recipientUserId,
        publicNotification(notification),
        unreadCount,
      );
    }),
  );
}

export async function createNotificationRecords(
  tx: Prisma.TransactionClient,
  inputs: CreateNotificationRecordInput[],
): Promise<NotificationDeliveryItem[]> {
  const uniqueInputs = new Map<string, CreateNotificationRecordInput>();

  for (const input of inputs) {
    if (input.actorUserId && input.actorUserId === input.recipientUserId) {
      continue;
    }

    const key = [
      input.tenantId,
      input.recipientUserId,
      input.type,
      input.targetType ?? "",
      input.targetId ?? "",
    ].join(":");
    if (!uniqueInputs.has(key)) {
      uniqueInputs.set(key, input);
    }
  }

  const created = await Promise.all(
    [...uniqueInputs.values()].map((input) =>
      tx.notification.create({
        data: {
          tenantId: input.tenantId,
          recipientUserId: input.recipientUserId,
          actorUserId: input.actorUserId ?? null,
          type: input.type,
          title: input.title,
          body: input.body,
          targetType: input.targetType,
          targetId: input.targetId,
          metadata: input.metadata,
        },
        select: notificationSelect,
      }),
    ),
  );

  return created.map(mapNotification);
}

export function createJobAssignedNotification(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorUserId: string;
    recipientUserId: string;
    jobId: string;
    jobTitle: string;
  },
) {
  return createNotificationRecords(tx, [
    {
      tenantId: input.tenantId,
      recipientUserId: input.recipientUserId,
      actorUserId: input.actorUserId,
      type: NotificationType.JOB_ASSIGNED,
      title: "Job assigned",
      body: `You have been assigned to ${input.jobTitle}.`,
      targetType: "job",
      targetId: input.jobId,
      metadata: {
        jobId: input.jobId,
        jobTitle: input.jobTitle,
      },
    },
  ]);
}

export function createJobUnassignedNotification(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorUserId: string;
    recipientUserId: string;
    jobId: string;
    jobTitle: string;
  },
) {
  return createNotificationRecords(tx, [
    {
      tenantId: input.tenantId,
      recipientUserId: input.recipientUserId,
      actorUserId: input.actorUserId,
      type: NotificationType.JOB_UNASSIGNED,
      title: "Job unassigned",
      body: `You have been removed from ${input.jobTitle}.`,
      targetType: "job",
      targetId: input.jobId,
      metadata: {
        jobId: input.jobId,
        jobTitle: input.jobTitle,
      },
    },
  ]);
}

export function createJobStatusChangedNotification(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorUserId: string;
    recipientUserId?: string | null;
    jobId: string;
    jobTitle: string;
    fromStatus: string;
    toStatus: string;
  },
) {
  if (!input.recipientUserId) {
    return Promise.resolve([]);
  }

  return createNotificationRecords(tx, [
    {
      tenantId: input.tenantId,
      recipientUserId: input.recipientUserId,
      actorUserId: input.actorUserId,
      type: NotificationType.JOB_STATUS_CHANGED,
      title: "Job status updated",
      body: `${input.jobTitle} moved from ${displayStatus(input.fromStatus)} to ${displayStatus(input.toStatus)}.`,
      targetType: "job",
      targetId: input.jobId,
      metadata: {
        jobId: input.jobId,
        jobTitle: input.jobTitle,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
      },
    },
  ]);
}

export async function createJobCompletionSubmittedNotifications(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorUserId: string;
    jobId: string;
    jobTitle: string;
  },
) {
  const recipients = await tx.membership.findMany({
    where: {
      tenantId: input.tenantId,
      status: MembershipStatus.ACTIVE,
      role: {
        in: [MembershipRole.OWNER, MembershipRole.MANAGER],
      },
      userId: {
        not: input.actorUserId,
      },
    },
    select: {
      userId: true,
    },
  });

  return createNotificationRecords(
    tx,
    recipients.map((recipient) => ({
      tenantId: input.tenantId,
      recipientUserId: recipient.userId,
      actorUserId: input.actorUserId,
      type: NotificationType.JOB_COMPLETION_SUBMITTED,
      title: "Completion ready for review",
      body: `${input.jobTitle} is ready for review.`,
      targetType: "job",
      targetId: input.jobId,
      metadata: {
        jobId: input.jobId,
        jobTitle: input.jobTitle,
      },
    })),
  );
}

export function createJobCompletionApprovedNotifications(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorUserId: string;
    recipientUserIds: string[];
    jobId: string;
    jobTitle: string;
  },
) {
  return createNotificationRecords(
    tx,
    input.recipientUserIds.map((recipientUserId) => ({
      tenantId: input.tenantId,
      recipientUserId,
      actorUserId: input.actorUserId,
      type: NotificationType.JOB_COMPLETION_APPROVED,
      title: "Completion approved",
      body: `${input.jobTitle} has been approved.`,
      targetType: "job",
      targetId: input.jobId,
      metadata: {
        jobId: input.jobId,
        jobTitle: input.jobTitle,
      },
    })),
  );
}

export function createJobCompletionReturnedNotifications(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorUserId: string;
    recipientUserIds: string[];
    jobId: string;
    jobTitle: string;
    reviewNote: string;
  },
) {
  return createNotificationRecords(
    tx,
    input.recipientUserIds.map((recipientUserId) => ({
      tenantId: input.tenantId,
      recipientUserId,
      actorUserId: input.actorUserId,
      type: NotificationType.JOB_COMPLETION_RETURNED,
      title: "Completion returned",
      body: `${input.jobTitle} was returned for rework.`,
      targetType: "job",
      targetId: input.jobId,
      metadata: {
        jobId: input.jobId,
        jobTitle: input.jobTitle,
        reviewNote: input.reviewNote,
      },
    })),
  );
}

export async function listNotifications(
  auth: AuthContext,
  query: NotificationListQueryInput,
): Promise<NotificationListResult> {
  const where = {
    tenantId: auth.tenantId,
    recipientUserId: auth.userId,
    ...(query.status === "unread" ? { readAt: null } : {}),
  } satisfies Prisma.NotificationWhereInput;
  const skip = (query.page - 1) * query.pageSize;

  const [total, notifications] = await prisma.$transaction([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: query.pageSize,
      select: notificationSelect,
    }),
  ]);

  return {
    items: notifications.map((notification) =>
      publicNotification(mapNotification(notification)),
    ),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function getUnreadNotificationCount(auth: AuthContext) {
  return unreadCountFor(auth.tenantId, auth.userId);
}

export async function markNotificationRead(
  auth: AuthContext,
  notificationId: string,
): Promise<NotificationItem> {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      tenantId: auth.tenantId,
      recipientUserId: auth.userId,
    },
    select: {
      id: true,
      readAt: true,
    },
  });

  if (!notification) {
    throw new ApiError(404, "Notification not found.");
  }

  const updated = notification.readAt
    ? await prisma.notification.findUniqueOrThrow({
        where: {
          id: notification.id,
        },
        select: notificationSelect,
      })
    : await prisma.notification.update({
        where: {
          id: notification.id,
        },
        data: {
          readAt: new Date(),
        },
        select: notificationSelect,
      });

  await publishUnreadCountFor(auth.tenantId, auth.userId);

  return publicNotification(mapNotification(updated));
}

export async function markAllNotificationsRead(auth: AuthContext) {
  const result = await prisma.notification.updateMany({
    where: {
      tenantId: auth.tenantId,
      recipientUserId: auth.userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  await publishUnreadCountFor(auth.tenantId, auth.userId);

  return {
    updatedCount: result.count,
  };
}

export async function openNotificationStream(
  auth: AuthContext,
  req: Request,
  res: Response,
) {
  const unreadCount = await getUnreadNotificationCount(auth);
  subscribeNotificationStream(auth, req, res, unreadCount);
}
