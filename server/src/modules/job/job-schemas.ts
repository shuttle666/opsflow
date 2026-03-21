import { JobStatus } from "@prisma/client";
import { z } from "zod";

const optionalDateTimeSchema = z
  .union([z.string().trim().datetime({ offset: true }), z.literal("")])
  .optional();

const optionalStringSchema = z.string().trim().max(5000).optional().or(z.literal(""));

export const createJobSchema = z
  .object({
    customerId: z.uuid(),
    title: z.string().trim().min(1, "Job title is required."),
    description: optionalStringSchema,
    scheduledAt: optionalDateTimeSchema,
  })
  .strict();

export const updateJobSchema = createJobSchema.strict();

export const jobIdParamSchema = z.object({
  jobId: z.uuid(),
});

export const assignJobSchema = z
  .object({
    membershipId: z.uuid(),
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
      "scheduledAt_asc",
      "scheduledAt_desc",
    ])
    .default("createdAt_desc"),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type JobIdParamInput = z.infer<typeof jobIdParamSchema>;
export type AssignJobInput = z.infer<typeof assignJobSchema>;
export type TransitionJobStatusInput = z.infer<typeof transitionJobStatusSchema>;
export type JobListQueryInput = z.infer<typeof jobListQuerySchema>;
