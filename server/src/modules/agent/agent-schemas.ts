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
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    return typeof value === "string" && value ? value : null;
  });
const optionalLocalDateSchema = z
  .union([
    z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/u),
    z.literal(""),
    z.null(),
  ])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    return typeof value === "string" && value ? value : null;
  });
const optionalLocalTimeSchema = z
  .union([
    z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/u),
    z.literal(""),
    z.null(),
  ])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    return typeof value === "string" && value ? value : null;
  });

const agentIntentSchema = z.enum([
  "READ_ONLY_QUERY",
  "CREATE_CUSTOMER",
  "UPDATE_CUSTOMER",
  "CREATE_JOB",
  "UPDATE_JOB",
  "ASSIGN_JOB",
  "SCHEDULE_JOB",
  "CHANGE_JOB_STATUS",
  "CANCEL_JOB",
]);

export const conversationIdParamSchema = z.object({
  conversationId: z.uuid(),
});

export const proposalIdParamSchema = z.object({
  conversationId: z.uuid(),
  proposalId: z.uuid(),
});

export const updateProposalReviewSchema = z
  .object({
    customerId: optionalUuidSchema,
    jobId: optionalUuidSchema,
    membershipId: optionalUuidSchema,
    scheduleDraft: z
      .object({
        scheduledStartAt: optionalProposalDateTimeSchema,
        scheduledEndAt: optionalProposalDateTimeSchema,
        localDate: optionalLocalDateSchema,
        localEndDate: optionalLocalDateSchema,
        localStartTime: optionalLocalTimeSchema,
        localEndTime: optionalLocalTimeSchema,
        timezone: z.string().trim().min(1).max(100).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      !value.customerId &&
      !value.jobId &&
      !value.membershipId &&
      !value.scheduleDraft
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one proposal review update is required.",
      });
    }

    const start = value.scheduleDraft?.scheduledStartAt;
    const end = value.scheduleDraft?.scheduledEndAt;
    const localDate = value.scheduleDraft?.localDate;
    const localEndDate = value.scheduleDraft?.localEndDate;
    const localStart = value.scheduleDraft?.localStartTime;
    const localEnd = value.scheduleDraft?.localEndTime;

    if (localDate || localEndDate || localStart || localEnd) {
      if (!localDate || !localStart || !localEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduleDraft"],
          message: "Local schedule updates require localDate, localStartTime, and localEndTime.",
        });
      }

      return;
    }

    if ((start && !end) || (!start && end)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduleDraft", start ? "scheduledEndAt" : "scheduledStartAt"],
        message: "Both start and end time are required when scheduling a job.",
      });
      return;
    }

    if (start && end && new Date(end) <= new Date(start)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduleDraft", "scheduledEndAt"],
        message: "End time must be after the start time.",
      });
    }
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

export const classifyIntentToolInputSchema = z
  .object({
    content: z.string().trim().min(1).max(4000),
  })
  .strict();

export const resolveCustomerTargetToolInputSchema = z
  .object({
    q: optionalTrimmedStringSchema,
    name: optionalTrimmedStringSchema,
    phone: z.string().trim().max(50).optional(),
    email: z.string().trim().email().optional().or(z.literal("")),
  })
  .strict();

export const resolveJobTargetToolInputSchema = z
  .object({
    q: optionalTrimmedStringSchema,
    title: optionalTrimmedStringSchema,
    description: optionalTrimmedStringSchema,
    serviceAddress: z.string().trim().max(500).optional(),
    concepts: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
    customerId: optionalUuidSchema,
    includeClosed: z.boolean().optional().default(false),
  })
  .strict();

export const resolveStaffTargetToolInputSchema = z
  .object({
    q: z.string().trim().min(1).max(200),
  })
  .strict();

export const resolveTimeWindowToolInputSchema = z
  .object({
    scheduledStartAt: optionalProposalDateTimeSchema,
    scheduledEndAt: optionalProposalDateTimeSchema,
    localDate: optionalLocalDateSchema,
    localEndDate: optionalLocalDateSchema,
    localStartTime: optionalLocalTimeSchema,
    localEndTime: optionalLocalTimeSchema,
    timezone: z.string().trim().min(1).max(100),
  })
  .strict();

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
    localDate: optionalLocalDateSchema,
    localEndDate: optionalLocalDateSchema,
    localStartTime: optionalLocalTimeSchema,
    localEndTime: optionalLocalTimeSchema,
    timezone: z.string().trim().min(1).max(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    const start = value.scheduledStartAt;
    const end = value.scheduledEndAt;
    const localDate = value.localDate;
    const localEndDate = value.localEndDate;
    const localStart = value.localStartTime;
    const localEnd = value.localEndTime;

    if (localDate || localEndDate || localStart || localEnd) {
      if (!localDate || !localStart || !localEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["localDate"],
          message: "Local schedules require localDate, localStartTime, and localEndTime.",
        });
      }

      return;
    }

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
        serviceAddress: z.string().trim().max(500).optional(),
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

    if (
      intent !== "create_customer" &&
      !value.jobDraft.existingJobId &&
      !value.jobDraft.serviceAddress?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["jobDraft", "serviceAddress"],
        message: "New job proposals require jobDraft.serviceAddress.",
      });
    }
  });

const proposalChangeSchema = z
  .object({
    field: z.enum(["name", "phone", "email", "notes"]),
    from: z.union([z.string(), z.null()]),
    to: z.union([z.string(), z.null()]),
  })
  .strict();

const typedProposalTargetSchema = z
  .object({
    customerId: optionalUuidSchema,
    jobId: optionalUuidSchema,
  })
  .strict();

const typedStatusDraftSchema = z
  .object({
    toStatus: z.nativeEnum(JobStatus),
    reason: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .strict();

const typedProposalReviewJobCandidateSchema = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(1).max(200),
    serviceAddress: z.string().trim().max(500).optional(),
    status: z.nativeEnum(JobStatus),
    scheduledStartAt: z
      .union([z.string().trim().datetime({ offset: true }), z.null()])
      .optional()
      .transform((value) => value ?? null),
    scheduledEndAt: z
      .union([z.string().trim().datetime({ offset: true }), z.null()])
      .optional()
      .transform((value) => value ?? null),
    assignedToName: z
      .union([z.string().trim().max(200), z.null()])
      .optional()
      .transform((value) => value ?? null),
    customer: z
      .object({
        id: z.uuid(),
        name: z.string().trim().min(1).max(200),
      })
      .strict()
      .optional(),
    score: z.number().min(0).max(1).optional(),
  })
  .strict();

const typedProposalReviewSchema = z
  .object({
    candidates: z
      .object({
        jobs: z.array(typedProposalReviewJobCandidateSchema).max(10).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const saveTypedProposalToolInputSchema = z
  .object({
    type: agentIntentSchema.exclude(["READ_ONLY_QUERY"]),
    intent: z.string().trim().min(1).max(100).optional(),
    target: typedProposalTargetSchema.optional(),
    customer: dispatchCustomerSchema,
    jobDraft: z
      .object({
        existingJobId: optionalUuidSchema,
        title: z.string().trim().min(1, "Job title is required.").max(200),
        serviceAddress: z.string().trim().max(500).optional(),
        description: optionalProposalStringSchema,
      })
      .strict()
      .optional(),
    scheduleDraft: dispatchScheduleDraftSchema.optional(),
    assigneeDraft: dispatchAssigneeDraftSchema.optional(),
    statusDraft: typedStatusDraftSchema.optional(),
    changes: z.array(proposalChangeSchema).max(10).optional(),
    review: typedProposalReviewSchema.optional(),
    warnings: z.array(z.string().trim().max(1000)).max(20).default([]),
    confidence: z.number().min(0).max(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    const type = value.type;
    const existingJobId = value.jobDraft?.existingJobId ?? value.target?.jobId;

    if (type === "UPDATE_CUSTOMER") {
      if (
        !value.target?.customerId &&
        !value.customer.matchedCustomerId &&
        value.customer.status !== "ambiguous"
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["target", "customerId"],
          message: "Customer update proposals require a target customer ID.",
        });
      }

      if (!value.changes?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["changes"],
          message: "Customer update proposals require at least one field change.",
        });
      }
      return;
    }

    if (type === "CREATE_CUSTOMER") {
      if (value.jobDraft?.existingJobId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["jobDraft", "existingJobId"],
          message: "Customer-only proposals cannot update an existing job.",
        });
      }
      return;
    }

    if (!value.jobDraft) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["jobDraft"],
        message: "Job proposal types require jobDraft.",
      });
      return;
    }

    if (type === "CREATE_JOB" && !value.jobDraft.serviceAddress?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["jobDraft", "serviceAddress"],
        message: "New job proposals require jobDraft.serviceAddress.",
      });
    }

    if (
      ["ASSIGN_JOB", "SCHEDULE_JOB"].includes(type) &&
      value.assigneeDraft?.status === "matched" &&
      !value.assigneeDraft.membershipId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assigneeDraft", "membershipId"],
        message: "Matched assignees require membershipId.",
      });
    }

    if (type === "CHANGE_JOB_STATUS" && !value.statusDraft) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["statusDraft"],
        message: "Status change proposals require statusDraft.",
      });
    }

    if (type === "CANCEL_JOB" && value.statusDraft && value.statusDraft.toStatus !== JobStatus.CANCELLED) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["statusDraft", "toStatus"],
        message: "Cancel proposals must transition the job to CANCELLED.",
      });
    }
  });

export type ConversationIdParamInput = z.infer<typeof conversationIdParamSchema>;
export type ProposalIdParamInput = z.infer<typeof proposalIdParamSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type UpdateProposalReviewInput = z.infer<
  typeof updateProposalReviewSchema
>;
export type SaveDispatchProposalToolInput = z.infer<
  typeof saveDispatchProposalToolInputSchema
>;
export type SaveTypedProposalToolInput = z.infer<
  typeof saveTypedProposalToolInputSchema
>;
