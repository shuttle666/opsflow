import { z } from "zod";

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(["all", "unread"]).default("all"),
});

export const notificationIdParamSchema = z.object({
  notificationId: z.uuid(),
});

export type NotificationListQueryInput = z.infer<typeof notificationListQuerySchema>;
export type NotificationIdParamInput = z.infer<typeof notificationIdParamSchema>;
