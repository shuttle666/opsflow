import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireTenantAccess } from "../../middleware/require-tenant-access";
import {
  listNotificationsHandler,
  markAllNotificationsReadHandler,
  markNotificationReadHandler,
  notificationStreamHandler,
  unreadNotificationCountHandler,
} from "./notification.controller";

const notificationRouter = Router();

notificationRouter.use(authenticate, requireTenantAccess);

notificationRouter.get("/", listNotificationsHandler);
notificationRouter.get("/unread-count", unreadNotificationCountHandler);
notificationRouter.get("/stream", notificationStreamHandler);
notificationRouter.post("/read-all", markAllNotificationsReadHandler);
notificationRouter.patch("/:notificationId/read", markNotificationReadHandler);

export { notificationRouter };
