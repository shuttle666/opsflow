import { z } from "zod";

export const dashboardSummaryQuerySchema = z
  .object({
    date: z.string().trim().date(),
    timezoneOffsetMinutes: z.coerce.number().int().min(-840).max(840).default(0),
    schedulePreviewLimit: z.coerce.number().int().min(1).max(20).default(6),
    attentionLimit: z.coerce.number().int().min(1).max(20).default(4),
  })
  .strict();

export type DashboardSummaryQueryInput = z.infer<
  typeof dashboardSummaryQuerySchema
>;
