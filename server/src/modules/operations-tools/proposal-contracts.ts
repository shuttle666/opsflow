import { JobStatus } from "@prisma/client";
import { z } from "zod";

const optionalNullableText = z.string().trim().max(5000).nullable().optional();

export const localScheduleInputSchema = z
  .object({
    localDate: z.string().trim().date(),
    localEndDate: z.string().trim().date().optional(),
    localStartTime: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/u),
    localEndTime: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/u),
    timezone: z.string().trim().min(1).max(100),
  })
  .strict();

export const createCustomerProposalInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    phone: z.string().trim().max(100).optional(),
    email: z.string().trim().email().max(320).optional(),
    notes: z.string().trim().max(5000).optional(),
  })
  .strict();

export const updateCustomerProposalInputSchema = z
  .object({
    customerId: z.uuid(),
    changes: z
      .object({
        name: z.string().trim().min(1).max(200).optional(),
        phone: optionalNullableText,
        email: z.string().trim().email().max(320).nullable().optional(),
        notes: optionalNullableText,
      })
      .strict()
      .refine((value) => Object.values(value).some((item) => item !== undefined), {
        message: "At least one customer change is required.",
      }),
  })
  .strict();

const existingCustomerInputSchema = z
  .object({
    kind: z.literal("existing"),
    customerId: z.uuid(),
  })
  .strict();

const newCustomerInputSchema = createCustomerProposalInputSchema
  .extend({ kind: z.literal("new") })
  .strict();

export const createJobProposalInputSchema = z
  .object({
    customer: z.discriminatedUnion("kind", [
      existingCustomerInputSchema,
      newCustomerInputSchema,
    ]),
    title: z.string().trim().min(1).max(200),
    serviceAddress: z.string().trim().min(1).max(500),
    description: z.string().trim().max(5000).optional(),
    assigneeMembershipId: z.uuid().optional(),
    schedule: localScheduleInputSchema.optional(),
  })
  .strict();

export const updateJobProposalInputSchema = z
  .object({
    jobId: z.uuid(),
    changes: z
      .object({
        title: z.string().trim().min(1).max(200).optional(),
        serviceAddress: z.string().trim().min(1).max(500).optional(),
        description: optionalNullableText,
      })
      .strict()
      .refine((value) => Object.values(value).some((item) => item !== undefined), {
        message: "At least one job change is required.",
      }),
  })
  .strict();

export const dispatchJobProposalInputSchema = z
  .object({
    jobId: z.uuid(),
    assigneeMembershipId: z.uuid().optional(),
    schedule: localScheduleInputSchema.optional(),
  })
  .strict()
  .refine((value) => value.assigneeMembershipId || value.schedule, {
    message: "An assignee or schedule is required.",
  });

export const changeJobStatusProposalInputSchema = z
  .object({
    jobId: z.uuid(),
    toStatus: z.nativeEnum(JobStatus).refine(
      (status) => status !== JobStatus.CANCELLED,
      "Use propose_cancel_job for cancellation.",
    ),
    reason: z.string().trim().max(5000).optional(),
  })
  .strict();

export const cancelJobProposalInputSchema = z
  .object({
    jobId: z.uuid(),
    reason: z.string().trim().min(1).max(5000),
  })
  .strict();

export const proposalSchema = z
  .object({
    id: z.string(),
    conversationId: z.string(),
    intent: z.string(),
    type: z.string().optional(),
    createdAt: z.date(),
  })
  .passthrough();

export const proposalToolOutputSchema = z.object({
  saved: z.literal(true),
  proposalId: z.string(),
  reviewStatus: z.enum(["READY", "NEEDS_RESOLUTION", "HAS_WARNINGS"]),
  approvalRequired: z.literal(true),
  approvalUrl: z.string().url(),
  approvalMode: z.enum(["CONVERSATIONAL_OR_WEB", "WEB_ONLY"]),
  executionTool: z.literal("execute_proposal").nullable(),
  confirmationPrompt: z.string(),
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  proposal: proposalSchema,
});

export type CreateCustomerProposalInput = z.infer<
  typeof createCustomerProposalInputSchema
>;
export type UpdateCustomerProposalInput = z.infer<
  typeof updateCustomerProposalInputSchema
>;
export type CreateJobProposalInput = z.infer<typeof createJobProposalInputSchema>;
export type UpdateJobProposalInput = z.infer<typeof updateJobProposalInputSchema>;
export type DispatchJobProposalInput = z.infer<
  typeof dispatchJobProposalInputSchema
>;
export type ChangeJobStatusProposalInput = z.infer<
  typeof changeJobStatusProposalInputSchema
>;
export type CancelJobProposalInput = z.infer<typeof cancelJobProposalInputSchema>;
export type LocalScheduleInput = z.infer<typeof localScheduleInputSchema>;
