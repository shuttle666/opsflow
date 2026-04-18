import type { RequestHandler } from "express";
import { ApiError } from "../../utils/api-error";
import { sendSuccess } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import {
  notificationIdParamSchema,
  notificationListQuerySchema,
} from "./notification-schemas";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  openNotificationStream,
} from "./notification.service";

export const listNotificationsHandler: RequestHandler = asyncHandler(
  async (req, res) => {
    if (!req.auth) {
      throw new ApiError(401, "Authentication is required.");
    }

    const query = notificationListQuerySchema.parse(req.query);
    const result = await listNotifications(req.auth, query);

    sendSuccess(res, {
      message: "Notifications loaded.",
      data: result.items,
      meta: {
        pagination: result.pagination,
      },
    });
  },
);

export const unreadNotificationCountHandler: RequestHandler = asyncHandler(
  async (req, res) => {
    if (!req.auth) {
      throw new ApiError(401, "Authentication is required.");
    }

    const unreadCount = await getUnreadNotificationCount(req.auth);

    sendSuccess(res, {
      message: "Unread notification count loaded.",
      data: {
        unreadCount,
      },
    });
  },
);

export const markNotificationReadHandler: RequestHandler = asyncHandler(
  async (req, res) => {
    if (!req.auth) {
      throw new ApiError(401, "Authentication is required.");
    }

    const { notificationId } = notificationIdParamSchema.parse(req.params);
    const notification = await markNotificationRead(req.auth, notificationId);

    sendSuccess(res, {
      message: "Notification marked as read.",
      data: notification,
    });
  },
);

export const markAllNotificationsReadHandler: RequestHandler = asyncHandler(
  async (req, res) => {
    if (!req.auth) {
      throw new ApiError(401, "Authentication is required.");
    }

    const result = await markAllNotificationsRead(req.auth);

    sendSuccess(res, {
      message: "Notifications marked as read.",
      data: result,
    });
  },
);

export const notificationStreamHandler: RequestHandler = asyncHandler(
  async (req, res) => {
    if (!req.auth) {
      throw new ApiError(401, "Authentication is required.");
    }

    await openNotificationStream(req.auth, req, res);
  },
);
