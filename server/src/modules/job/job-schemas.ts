import { JobStatus } from "@prisma/client";
import { z } from "zod";

const optionalDateTimeSchema = z
  .union([z.string().trim().datetime({ offset: true }), z.literal("")])
  .optional();

const optionalStringSchema = z.string().trim().max(5000).optional().or(z.literal(""));
const serviceAddressSchema = z.string().trim().min(1, "Service address is required.").max(500);

export const createJobSchema = z
  .object({
    customerId: z.uuid(),
    title: z.string().trim().min(1, "Job title is required."),
    serviceAddress: serviceAddressSchema,
    description: optionalStringSchema,
    scheduledStartAt: optionalDateTimeSchema,
    scheduledEndAt: optionalDateTimeSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const start = value.scheduledStartAt?.trim();
    const end = value.scheduledEndAt?.trim();

    if ((start && !end) || (!start && end)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [start ? "scheduledEndAt" : "scheduledStartAt"],
        message: "Both start and end time are required when scheduling a job.",
      });
      return;
    }

    if (start && end && new Date(end) <= new Date(start)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledEndAt"],
        message: "End time must be after the start time.",
      });
    }
  });

export const updateJobSchema = createJobSchema.strict();

export const jobIdParamSchema = z.object({
  jobId: z.uuid(),
});

export const jobCompletionReviewIdParamSchema = jobIdParamSchema.extend({
  reviewId: z.uuid(),
});

export const assignJobSchema = z
  .object({
    membershipId: z.uuid(),
  })
  .strict();

export const submitJobCompletionReviewSchema = z
  .object({
    completionNote: z.string().trim().min(1, "Completion note is required.").max(5000),
  })
  .strict();

export const returnJobCompletionReviewSchema = z
  .object({
    reviewNote: z.string().trim().min(1, "Return note is required.").max(5000),
  })
  .strict();

export const transitionJobStatusSchema = z
  .object({
    toStatus: z.nativeEnum(JobStatus),
    reason: optionalStringSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const reason = typeof value.reason === "string" ? value.reason.trim() : "";
    if (value.toStatus === JobStatus.CANCELLED && !reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Cancellation reason is required.",
      });
    }
  });

export const jobListQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.nativeEnum(JobStatus).optional(),
  customerId: z.uuid().optional(),
  scheduledFrom: z.string().trim().datetime({ offset: true }).optional(),
  scheduledTo: z.string().trim().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  sort: z
    .enum([
      "createdAt_desc",
      "createdAt_asc",
      "scheduledStartAt_asc",
      "scheduledStartAt_desc",
    ])
    .default("createdAt_desc"),
});

export const scheduleDayQuerySchema = z
  .object({
    date: z.string().trim().date(),
    assigneeId: z.uuid().optional(),
    timezoneOffsetMinutes: z.coerce.number().int().min(-840).max(840).optional(),
  })
  .strict();

export const scheduleRangeQuerySchema = z
  .object({
    rangeStart: z.string().trim().datetime({ offset: true }),
    rangeEnd: z.string().trim().datetime({ offset: true }),
    assigneeId: z.uuid().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const rangeStart = new Date(value.rangeStart);
    const rangeEnd = new Date(value.rangeEnd);

    if (rangeEnd <= rangeStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rangeEnd"],
        message: "Range end must be after range start.",
      });
    }
  });

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type JobIdParamInput = z.infer<typeof jobIdParamSchema>;
export type JobCompletionReviewIdParamInput = z.infer<typeof jobCompletionReviewIdParamSchema>;
export type AssignJobInput = z.infer<typeof assignJobSchema>;
export type SubmitJobCompletionReviewInput = z.infer<typeof submitJobCompletionReviewSchema>;
export type ReturnJobCompletionReviewInput = z.infer<typeof returnJobCompletionReviewSchema>;
export type TransitionJobStatusInput = z.infer<typeof transitionJobStatusSchema>;
export type JobListQueryInput = z.infer<typeof jobListQuerySchema>;
export type ScheduleDayQueryInput = z.infer<typeof scheduleDayQuerySchema>;
export type ScheduleRangeQueryInput = z.infer<typeof scheduleRangeQuerySchema>;
