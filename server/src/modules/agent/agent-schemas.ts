import {
  JobStatus,
  MembershipRole,
  MembershipStatus,
} from "@prisma/client";
import { z } from "zod";

const pageSchema = z.coerce.number().int().min(1).default(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(50).default(10);
const optionalTrimmedStringSchema = z.string().trim().optional();
const optionalDateTimeSchema = z.string().trim().datetime({ offset: true }).optional();
const optionalUuidSchema = z.uuid().optional();

const optionalProposalStringSchema = z
  .union([z.string().trim().max(5000), z.null()])
  .optional()
  .transform((value) => value ?? undefined);

const optionalProposalDateTimeSchema = z
  .union([z.string().trim().datetime({ offset: true }), z.literal(""), z.null()])
  .optional()
  .transform((value) => (typeof value === "string" && value ? value : null));

export const conversationIdParamSchema = z.object({
  conversationId: z.uuid(),
});

export const proposalIdParamSchema = z.object({
  conversationId: z.uuid(),
  proposalId: z.uuid(),
});

export const sendMessageSchema = z
  .object({
    content: z.string().trim().min(1, "Message is required.").max(4000),
    timezone: z.string().trim().min(1).max(100),
  })
  .strict();

export const listJobsToolInputSchema = z
  .object({
    q: optionalTrimmedStringSchema,
    status: z.nativeEnum(JobStatus).optional(),
    customerId: optionalUuidSchema,
    scheduledFrom: optionalDateTimeSchema,
    scheduledTo: optionalDateTimeSchema,
    page: pageSchema,
    pageSize: pageSizeSchema,
  })
  .strict();

export const getJobDetailToolInputSchema = z
  .object({
    jobId: z.uuid(),
  })
  .strict();

export const listCustomersToolInputSchema = z
  .object({
    q: optionalTrimmedStringSchema,
    page: pageSchema,
    pageSize: pageSizeSchema,
  })
  .strict();

export const getCustomerDetailToolInputSchema = z
  .object({
    customerId: z.uuid(),
  })
  .strict();

export const listMembershipsToolInputSchema = z
  .object({
    q: optionalTrimmedStringSchema,
    role: z.nativeEnum(MembershipRole).optional(),
    status: z.nativeEnum(MembershipStatus).optional(),
    page: pageSchema,
    pageSize: pageSizeSchema,
  })
  .strict();

export const listActivityFeedToolInputSchema = z
  .object({
    page: pageSchema,
    pageSize: pageSizeSchema,
  })
  .strict();

export const checkScheduleConflictsToolInputSchema = z
  .object({
    assigneeUserId: z.uuid(),
    scheduledStartAt: z.string().trim().datetime({ offset: true }),
    scheduledEndAt: z.string().trim().datetime({ offset: true }),
    excludeJobId: optionalUuidSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Date(value.scheduledEndAt) <= new Date(value.scheduledStartAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledEndAt"],
        message: "End time must be after the start time.",
      });
    }
  });

const dispatchCustomerMatchSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(200),
  })
  .strict();

const dispatchCustomerSchema = z
  .object({
    status: z.enum(["matched", "new", "missing", "ambiguous"]),
    query: optionalTrimmedStringSchema,
    matchedCustomerId: optionalUuidSchema,
    name: z.string().trim().min(1).max(200).optional(),
    phone: z.string().trim().max(50).optional(),
    email: z.string().trim().email().optional().or(z.literal("")),
    address: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(2000).optional(),
    matches: z.array(dispatchCustomerMatchSchema).max(10).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const matchCount = value.matches?.length ?? 0;

    if (value.status === "matched" && !value.matchedCustomerId && matchCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["matchedCustomerId"],
        message: "Matched customers require matchedCustomerId or exactly one customer match.",
      });
    }

    if (value.status === "new" && !value.name?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "New customers require a customer name.",
      });
    }

    if (value.status === "ambiguous" && matchCount < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["matches"],
        message: "Ambiguous customers require at least two customer matches.",
      });
    }
  });

const dispatchScheduleDraftSchema = z
  .object({
    scheduledStartAt: optionalProposalDateTimeSchema,
    scheduledEndAt: optionalProposalDateTimeSchema,
    timezone: z.string().trim().min(1).max(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    const start = value.scheduledStartAt;
    const end = value.scheduledEndAt;

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

const dispatchAssigneeMatchSchema = z
  .object({
    membershipId: z.uuid(),
    userId: z.uuid(),
    displayName: z.string().trim().min(1).max(200),
  })
  .strict();

const dispatchAssigneeDraftSchema = z
  .object({
    status: z.enum(["matched", "missing", "ambiguous"]),
    membershipId: optionalUuidSchema,
    userId: optionalUuidSchema,
    displayName: z.string().trim().min(1).max(200).optional(),
    matches: z.array(dispatchAssigneeMatchSchema).max(10).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const matchCount = value.matches?.length ?? 0;

    if (value.status === "matched" && !value.membershipId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["membershipId"],
        message: "Matched assignees require membershipId.",
      });
    }

    if (value.status === "ambiguous" && matchCount < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["matches"],
        message: "Ambiguous assignees require at least two membership matches.",
      });
    }
  });

export const saveDispatchProposalToolInputSchema = z
  .object({
    intent: z.string().trim().min(1).max(100),
    customer: dispatchCustomerSchema,
    jobDraft: z
      .object({
        existingJobId: optionalUuidSchema,
        title: z.string().trim().min(1, "Job title is required.").max(200),
        description: optionalProposalStringSchema,
      })
      .strict(),
    scheduleDraft: dispatchScheduleDraftSchema,
    assigneeDraft: dispatchAssigneeDraftSchema.optional(),
    warnings: z.array(z.string().trim().max(1000)).max(20),
    confidence: z.number().min(0).max(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    const intent = value.intent.trim().toLowerCase();

    if (intent === "update_existing_job" && !value.jobDraft.existingJobId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["jobDraft", "existingJobId"],
        message: "Existing job update proposals require jobDraft.existingJobId.",
      });
    }

    if (intent === "create_customer" && value.jobDraft.existingJobId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["jobDraft", "existingJobId"],
        message: "Customer-only proposals cannot update an existing job.",
      });
    }
  });

export type ConversationIdParamInput = z.infer<typeof conversationIdParamSchema>;
export type ProposalIdParamInput = z.infer<typeof proposalIdParamSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type SaveDispatchProposalToolInput = z.infer<
  typeof saveDispatchProposalToolInputSchema
>;
