import type Anthropic from "@anthropic-ai/sdk";
import {
  AgentMessageRole,
  AgentProposalStatus,
  AuditAction,
  JobStatus,
  MembershipRole,
  MembershipStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { AuthContext } from "../../types/auth";
import { ApiError } from "../../utils/api-error";
import {
  createJobAssignedNotification,
  createJobStatusChangedNotification,
  publishCreatedNotifications,
  type NotificationDeliveryItem,
} from "../notification/notification.service";
import { transitionJobStatusInTransaction } from "../job/job-status.service";
import type {
  SaveTypedProposalToolInput,
  UpdateProposalReviewInput,
} from "./agent-schemas";
import {
  normalizeScheduleDraftTimezone,
  type ScheduleDraftWithLocalTime,
} from "./agent-time";

export type AgentProposalType =
  | "CREATE_CUSTOMER"
  | "UPDATE_CUSTOMER"
  | "CREATE_JOB"
  | "UPDATE_JOB"
  | "ASSIGN_JOB"
  | "SCHEDULE_JOB"
  | "CHANGE_JOB_STATUS"
  | "CANCEL_JOB";

export type AgentProposalChange = {
  field: "name" | "phone" | "email" | "notes";
  from: string | null;
  to: string | null;
};

export type ProposalReviewStatus = "READY" | "NEEDS_RESOLUTION" | "HAS_WARNINGS";

type ProposalReviewCustomerSnapshot = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

type ProposalReviewJobSnapshot = {
  id: string;
  title: string;
  serviceAddress: string;
  description: string | null;
  status: JobStatus;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  assignedToName: string | null;
  customer: {
    id: string;
    name: string;
  };
};

type ProposalReviewStaffSnapshot = {
  membershipId: string;
  userId: string;
  displayName: string;
  email: string;
};

type ProposalReviewCustomerCandidate = {
  id: string;
  name: string;
};

type ProposalReviewJobCandidate = {
  id: string;
  title: string;
  serviceAddress?: string;
  status: JobStatus;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  assignedToName: string | null;
  customer?: {
    id: string;
    name: string;
  };
};

type ProposalReviewStaffCandidate = {
  membershipId: string;
  userId: string;
  displayName: string;
};

export type ProposalReview = {
  status: ProposalReviewStatus;
  blockers: string[];
  warnings: string[];
  snapshots?: {
    customer?: ProposalReviewCustomerSnapshot;
    job?: ProposalReviewJobSnapshot;
    assignee?: ProposalReviewStaffSnapshot;
  };
  candidates?: {
    customers?: ProposalReviewCustomerCandidate[];
    jobs?: ProposalReviewJobCandidate[];
    staff?: ProposalReviewStaffCandidate[];
  };
  scheduleConflicts?: {
    hasConflict: boolean;
    conflicts: Array<{
      id: string;
      title: string;
      serviceAddress: string;
      status: JobStatus;
      scheduledStartAt: string;
      scheduledEndAt: string;
      customer: {
        id: string;
        name: string;
      };
    }>;
  };
};

export type DispatchProposal = {
  id: string;
  conversationId: string;
  tenantId: string;
  userId: string;
  type?: AgentProposalType;
  intent: string;
  target?: {
    customerId?: string;
    jobId?: string;
  };
  customer: {
    status: "matched" | "new" | "missing" | "ambiguous";
    query?: string;
    matchedCustomerId?: string;
    name?: string;
    phone?: string;
    email?: string;
    notes?: string;
    matches?: Array<{
      id: string;
      name: string;
    }>;
  };
  jobDraft: {
    existingJobId?: string;
    title: string;
    serviceAddress?: string;
    description?: string | null;
  };
  scheduleDraft: {
    scheduledStartAt?: string | null;
    scheduledEndAt?: string | null;
    localDate?: string | null;
    localEndDate?: string | null;
    localStartTime?: string | null;
    localEndTime?: string | null;
    timezone: string;
  };
  assigneeDraft?: {
    status: "matched" | "missing" | "ambiguous";
    membershipId?: string;
    userId?: string;
    displayName?: string;
    matches?: Array<{
      membershipId: string;
      userId: string;
      displayName: string;
    }>;
  };
  statusDraft?: {
    toStatus: JobStatus;
    reason?: string | null;
  };
  changes?: AgentProposalChange[];
  review?: ProposalReview;
  warnings: string[];
  confidence: number;
  createdAt: Date;
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ name: string; input: unknown; result: unknown }>;
  proposal?: DispatchProposal;
  createdAt: Date;
};

export type Conversation = {
  id: string;
  tenantId: string;
  userId: string;
  messages: ConversationMessage[];
  claudeMessages: Anthropic.MessageParam[];
  createdAt: Date;
  updatedAt: Date;
};

export type ConversationSummary = {
  id: string;
  preview: string;
  createdAt: Date;
  updatedAt: Date;
};

type DispatchProposalPayload = Omit<
  DispatchProposal,
  "id" | "conversationId" | "tenantId" | "userId" | "createdAt"
>;

type ConfirmedProposalResult = {
  proposalId: string;
  proposalType?: AgentProposalType;
  entityType: "customer" | "job";
  createdCustomerId?: string;
  createdCustomerName?: string;
  updatedCustomerId?: string;
  updatedCustomerName?: string;
  usedExistingCustomer?: boolean;
  createdJobId?: string;
  createdJobTitle?: string;
  updatedExistingJob?: boolean;
  assignedToName?: string;
  transitionedTo?: JobStatus;
};

type ProposalJobTargetInput = Pick<
  DispatchProposalPayload,
  "intent" | "customer" | "jobDraft" | "scheduleDraft" | "assigneeDraft"
>;

const openDispatchJobStatuses: JobStatus[] = [
  JobStatus.NEW,
  JobStatus.SCHEDULED,
  JobStatus.IN_PROGRESS,
  JobStatus.PENDING_REVIEW,
];
const scheduleConflictWarningPrefix = "Schedule overlaps ";

const conversationInclude = {
  messages: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      toolCalls: {
        orderBy: { callOrder: "asc" },
      },
      proposal: true,
    },
  },
} satisfies Prisma.AgentConversationInclude;

type ConversationRecord = Prisma.AgentConversationGetPayload<{
  include: typeof conversationInclude;
}>;

type ProposalRecord = Prisma.AgentProposalGetPayload<object>;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function modelMessagesFromJson(value: Prisma.JsonValue): Anthropic.MessageParam[] {
  return Array.isArray(value) ? (value as unknown as Anthropic.MessageParam[]) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function proposalPayloadFromJson(value: Prisma.JsonValue): DispatchProposalPayload {
  const payload = isRecord(value) ? value : {};
  const customer = isRecord(payload.customer)
    ? (payload.customer as DispatchProposalPayload["customer"])
    : { status: "missing" as const };
  const jobDraft = isRecord(payload.jobDraft)
    ? (payload.jobDraft as DispatchProposalPayload["jobDraft"])
    : { title: "" };
  const scheduleDraft = isRecord(payload.scheduleDraft)
    ? (payload.scheduleDraft as DispatchProposalPayload["scheduleDraft"])
    : { timezone: "UTC" };
  const warnings = Array.isArray(payload.warnings)
    ? payload.warnings.map((warning) => String(warning))
    : [];
  const confidence =
    typeof payload.confidence === "number" ? payload.confidence : Number(payload.confidence ?? 0.5);

  return {
    type: typeof payload.type === "string" ? (payload.type as AgentProposalType) : undefined,
    intent: String(payload.intent ?? "dispatch_plan"),
    target: isRecord(payload.target)
      ? (payload.target as DispatchProposalPayload["target"])
      : undefined,
    customer,
    jobDraft,
    scheduleDraft,
    assigneeDraft: isRecord(payload.assigneeDraft)
      ? (payload.assigneeDraft as DispatchProposalPayload["assigneeDraft"])
      : undefined,
    statusDraft: isRecord(payload.statusDraft)
      ? (payload.statusDraft as DispatchProposalPayload["statusDraft"])
      : undefined,
    changes: Array.isArray(payload.changes)
      ? (payload.changes as DispatchProposalPayload["changes"])
      : undefined,
    review: isRecord(payload.review)
      ? (payload.review as DispatchProposalPayload["review"])
      : undefined,
    warnings,
    confidence: Number.isFinite(confidence) ? confidence : 0.5,
  };
}

function proposalFromRecord(record: ProposalRecord): DispatchProposal {
  const payload = proposalPayloadFromJson(record.payload);

  return {
    id: record.id,
    conversationId: record.conversationId,
    tenantId: record.tenantId,
    userId: record.userId,
    createdAt: record.createdAt,
    ...payload,
    intent: payload.intent || record.intent,
  };
}

function mapConversationMessage(
  message: ConversationRecord["messages"][number],
): ConversationMessage {
  const toolCalls = message.toolCalls.map((toolCall) => ({
    name: toolCall.toolName,
    input: toolCall.input,
    result: toolCall.result,
  }));

  return {
    id: message.id,
    role: message.role === AgentMessageRole.USER ? "user" : "assistant",
    content: message.content,
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    ...(message.proposal?.status === AgentProposalStatus.PENDING
      ? { proposal: proposalFromRecord(message.proposal) }
      : {}),
    createdAt: message.createdAt,
  };
}

function mapConversation(record: ConversationRecord): Conversation {
  return {
    id: record.id,
    tenantId: record.tenantId,
    userId: record.userId,
    messages: record.messages.map(mapConversationMessage),
    claudeMessages: modelMessagesFromJson(record.modelMessages),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function getConversationRecord(
  auth: AuthContext,
  conversationId: string,
): Promise<ConversationRecord | null> {
  return prisma.agentConversation.findFirst({
    where: {
      id: conversationId,
      tenantId: auth.tenantId,
      userId: auth.userId,
    },
    include: conversationInclude,
  });
}

export async function createConversation(auth: AuthContext): Promise<Conversation> {
  const conversation = await prisma.agentConversation.create({
    data: {
      tenantId: auth.tenantId,
      userId: auth.userId,
      preview: "",
      modelMessages: toJsonValue([]),
    },
    include: conversationInclude,
  });

  return mapConversation(conversation);
}

export async function getConversation(
  auth: AuthContext,
  conversationId: string,
): Promise<Conversation | null> {
  const conversation = await getConversationRecord(auth, conversationId);
  return conversation ? mapConversation(conversation) : null;
}

export async function listConversations(auth: AuthContext): Promise<ConversationSummary[]> {
  const conversations = await prisma.agentConversation.findMany({
    where: {
      tenantId: auth.tenantId,
      userId: auth.userId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      preview: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return conversations;
}

export async function addUserMessage(
  auth: AuthContext,
  conversationId: string,
  content: string,
): Promise<ConversationMessage> {
  const conversation = await prisma.agentConversation.findFirst({
    where: {
      id: conversationId,
      tenantId: auth.tenantId,
      userId: auth.userId,
    },
    select: {
      id: true,
      preview: true,
      modelMessages: true,
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  const claudeMessages = [
    ...modelMessagesFromJson(conversation.modelMessages),
    { role: "user", content } satisfies Anthropic.MessageParam,
  ];

  const message = await prisma.$transaction(async (tx) => {
    const createdMessage = await tx.agentMessage.create({
      data: {
        conversationId,
        role: AgentMessageRole.USER,
        content,
      },
    });

    await tx.agentConversation.update({
      where: { id: conversationId },
      data: {
        modelMessages: toJsonValue(claudeMessages),
        ...(conversation.preview ? {} : { preview: content.slice(0, 100) }),
      },
    });

    return createdMessage;
  });

  return {
    id: message.id,
    role: "user",
    content: message.content,
    createdAt: message.createdAt,
  };
}

export async function storeDispatchProposal(
  auth: AuthContext,
  conversationId: string,
  input: DispatchProposalPayload,
): Promise<DispatchProposal> {
  const conversation = await prisma.agentConversation.findFirst({
    where: {
      id: conversationId,
      tenantId: auth.tenantId,
      userId: auth.userId,
    },
    select: {
      id: true,
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  const proposal = await prisma.$transaction(async (tx) => {
    const payload = await withProposalReview(
      tx,
      auth,
      normalizeProposalPayloadSchedule(input),
    );

    const createdProposal = await tx.agentProposal.create({
      data: {
        conversationId,
        tenantId: auth.tenantId,
        userId: auth.userId,
        intent: payload.intent,
        payload: toJsonValue(payload),
        status: AgentProposalStatus.PENDING,
      },
    });

    await tx.agentConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return createdProposal;
  });

  return proposalFromRecord(proposal);
}

function typedProposalIntent(type: AgentProposalType) {
  return type.toLowerCase();
}

function typedProposalTitle(type: AgentProposalType, input: SaveTypedProposalToolInput) {
  if (input.jobDraft?.title) {
    return input.jobDraft.title;
  }

  if (type === "UPDATE_CUSTOMER") {
    return `Update customer: ${input.customer.name ?? input.customer.query ?? "Customer"}`;
  }

  return type.replace(/_/gu, " ").toLowerCase();
}

function normalizeProposalPayloadSchedule<T extends DispatchProposalPayload>(input: T): T {
  return {
    ...input,
    scheduleDraft: normalizeScheduleDraftTimezone(
      input.scheduleDraft as ScheduleDraftWithLocalTime,
    ),
  };
}

function typedProposalReviewCandidates(
  input: SaveTypedProposalToolInput,
): ProposalReview["candidates"] | undefined {
  const jobs = input.review?.candidates?.jobs?.map((job) => ({
    id: job.id,
    title: job.title,
    ...(job.serviceAddress ? { serviceAddress: job.serviceAddress } : {}),
    status: job.status,
    scheduledStartAt: job.scheduledStartAt,
    scheduledEndAt: job.scheduledEndAt,
    assignedToName: job.assignedToName,
    ...(job.customer ? { customer: job.customer } : {}),
  }));

  return jobs?.length ? { jobs } : undefined;
}

function typedProposalToDispatchPayload(
  input: SaveTypedProposalToolInput,
): DispatchProposalPayload {
  const type = input.type;
  const targetCustomerId = input.target?.customerId ?? input.customer.matchedCustomerId;
  const targetJobId = input.target?.jobId ?? input.jobDraft?.existingJobId;
  const reviewCandidates = typedProposalReviewCandidates(input);

  return {
    type,
    intent: input.intent ?? typedProposalIntent(type),
    target: {
      ...(targetCustomerId ? { customerId: targetCustomerId } : {}),
      ...(targetJobId ? { jobId: targetJobId } : {}),
    },
    customer: {
      ...input.customer,
      ...(targetCustomerId ? { matchedCustomerId: targetCustomerId } : {}),
    },
    jobDraft: {
      existingJobId: targetJobId,
      title: typedProposalTitle(type, input),
      serviceAddress: input.jobDraft?.serviceAddress,
      description: input.jobDraft?.description ?? null,
    },
    scheduleDraft: input.scheduleDraft ?? {
      timezone: "UTC",
    },
    assigneeDraft: input.assigneeDraft,
    statusDraft:
      type === "CANCEL_JOB" && !input.statusDraft
        ? { toStatus: JobStatus.CANCELLED }
        : input.statusDraft
          ? {
              toStatus: input.statusDraft.toStatus,
              reason: input.statusDraft.reason || null,
            }
          : undefined,
    changes: input.changes,
    ...(reviewCandidates
      ? {
          review: {
            status: "READY",
            blockers: [],
            warnings: [],
            candidates: reviewCandidates,
          },
        }
      : {}),
    warnings: input.warnings,
    confidence: input.confidence,
  };
}

export async function storeTypedProposal(
  auth: AuthContext,
  conversationId: string,
  input: SaveTypedProposalToolInput,
): Promise<DispatchProposal> {
  return storeDispatchProposal(auth, conversationId, typedProposalToDispatchPayload(input));
}

function findLatestProposal(
  toolCalls?: Array<{ name: string; input: unknown; result: unknown }>,
): DispatchProposal | undefined {
  for (let index = (toolCalls?.length ?? 0) - 1; index >= 0; index -= 1) {
    const call = toolCalls?.[index];
    if (call?.name !== "save_dispatch_proposal" && call?.name !== "save_typed_proposal") {
      continue;
    }

    const result = call.result as { proposal?: DispatchProposal } | undefined;
    if (result?.proposal) {
      return result.proposal;
    }
  }

  return undefined;
}

export async function appendAssistantMessage(
  conversationId: string,
  content: string,
  claudeMessages: Anthropic.MessageParam[],
  toolCalls?: Array<{ name: string; input: unknown; result: unknown }>,
): Promise<void> {
  const proposal = findLatestProposal(toolCalls);

  await prisma.$transaction(async (tx) => {
    const message = await tx.agentMessage.create({
      data: {
        conversationId,
        role: AgentMessageRole.ASSISTANT,
        content,
      },
    });

    if (toolCalls?.length) {
      await tx.agentToolCall.createMany({
        data: toolCalls.map((toolCall, index) => ({
          conversationId,
          messageId: message.id,
          toolName: toolCall.name,
          input: toJsonValue(toolCall.input),
          result: toJsonValue(toolCall.result),
          callOrder: index,
        })),
      });
    }

    if (proposal) {
      await tx.agentProposal.updateMany({
        where: {
          id: proposal.id,
          conversationId,
          status: AgentProposalStatus.PENDING,
        },
        data: {
          assistantMessageId: message.id,
        },
      });
    }

    await tx.agentConversation.update({
      where: { id: conversationId },
      data: {
        modelMessages: toJsonValue(claudeMessages),
      },
    });
  });
}

export async function appendLocalAssistantMessage(
  conversationId: string,
  content: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.agentMessage.create({
      data: {
        conversationId,
        role: AgentMessageRole.ASSISTANT,
        content,
      },
    }),
    prisma.agentConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);
}

export async function getProposal(
  auth: AuthContext,
  conversationId: string,
  proposalId: string,
): Promise<DispatchProposal | null> {
  const proposal = await prisma.agentProposal.findFirst({
    where: {
      id: proposalId,
      conversationId,
      tenantId: auth.tenantId,
      userId: auth.userId,
      status: AgentProposalStatus.PENDING,
    },
  });

  return proposal ? proposalFromRecord(proposal) : null;
}

export async function updateProposalReview(
  auth: AuthContext,
  conversationId: string,
  proposalId: string,
  input: UpdateProposalReviewInput,
): Promise<DispatchProposal> {
  if (auth.role === MembershipRole.STAFF) {
    throw new ApiError(403, "Only owners and managers can update dispatch plans.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const proposalRecord = await tx.agentProposal.findFirst({
      where: {
        id: proposalId,
        conversationId,
        tenantId: auth.tenantId,
        userId: auth.userId,
        status: AgentProposalStatus.PENDING,
      },
    });

    if (!proposalRecord) {
      throw new ApiError(404, "Proposal not found.");
    }

    let payload = proposalPayloadFromJson(proposalRecord.payload);

    if (input.customerId) {
      const customer = await getCustomerSnapshot(tx, auth, input.customerId);

      if (!customer) {
        throw new ApiError(404, "Customer not found.");
      }

      payload = {
        ...payload,
        target: {
          ...payload.target,
          customerId: customer.id,
        },
        customer: {
          ...payload.customer,
          status: "matched",
          matchedCustomerId: customer.id,
          name: customer.name,
          matches: [{ id: customer.id, name: customer.name }],
        },
      };
    }

    if (input.jobId) {
      const job = await getJobSnapshot(tx, auth, input.jobId);

      if (!job) {
        throw new ApiError(404, "Job not found.");
      }

      const existingCustomerId = payload.target?.customerId ?? resolveCustomerIdFromCustomer(payload.customer);
      if (existingCustomerId && existingCustomerId !== job.customer.id) {
        throw new ApiError(400, "Selected job belongs to a different customer.");
      }

      const nextType = payload.type === "CREATE_JOB"
        ? inferExistingJobType(payload)
        : payload.type;

      payload = {
        ...payload,
        ...(nextType ? { type: nextType, intent: typedProposalIntent(nextType) } : { intent: "update_existing_job" }),
        target: {
          ...payload.target,
          customerId: job.customer.id,
          jobId: job.id,
        },
        customer: {
          ...payload.customer,
          status: "matched",
          matchedCustomerId: job.customer.id,
          name: job.customer.name,
          matches: [{ id: job.customer.id, name: job.customer.name }],
        },
        jobDraft: {
          ...payload.jobDraft,
          existingJobId: job.id,
          title:
            payload.type === "UPDATE_JOB" && payload.jobDraft.title?.trim()
              ? payload.jobDraft.title
              : job.title,
        },
      };
    }

    if (input.membershipId) {
      const staff = await getStaffSnapshot(tx, auth, input.membershipId);

      if (!staff) {
        throw new ApiError(404, "Membership not found.");
      }

      payload = {
        ...payload,
        assigneeDraft: {
          status: "matched",
          membershipId: staff.membershipId,
          userId: staff.userId,
          displayName: staff.displayName,
          matches: [
            {
              membershipId: staff.membershipId,
              userId: staff.userId,
              displayName: staff.displayName,
            },
          ],
        },
      };
    }

    if (input.scheduleDraft) {
      const hasLocalUpdate =
        input.scheduleDraft.localDate !== undefined ||
        input.scheduleDraft.localEndDate !== undefined ||
        input.scheduleDraft.localStartTime !== undefined ||
        input.scheduleDraft.localEndTime !== undefined;
      const hasIsoUpdate =
        input.scheduleDraft.scheduledStartAt !== undefined ||
        input.scheduleDraft.scheduledEndAt !== undefined;

      payload = {
        ...payload,
        scheduleDraft: {
          ...payload.scheduleDraft,
          ...(hasIsoUpdate && !hasLocalUpdate
            ? {
                localDate: null,
                localEndDate: null,
                localStartTime: null,
                localEndTime: null,
              }
            : {}),
          ...(input.scheduleDraft.scheduledStartAt !== undefined
            ? { scheduledStartAt: input.scheduleDraft.scheduledStartAt }
            : {}),
          ...(input.scheduleDraft.scheduledEndAt !== undefined
            ? { scheduledEndAt: input.scheduleDraft.scheduledEndAt }
            : {}),
          ...(hasLocalUpdate
            ? {
                localDate: input.scheduleDraft.localDate ?? null,
                localEndDate: input.scheduleDraft.localEndDate ?? null,
                localStartTime: input.scheduleDraft.localStartTime ?? null,
                localEndTime: input.scheduleDraft.localEndTime ?? null,
              }
            : {}),
          ...(input.scheduleDraft.timezone ? { timezone: input.scheduleDraft.timezone } : {}),
        },
      };
    }

    const reviewed = await withProposalReview(
      tx,
      auth,
      normalizeProposalPayloadSchedule(payload),
    );
    const saved = await tx.agentProposal.update({
      where: { id: proposalRecord.id },
      data: {
        intent: reviewed.intent,
        payload: toJsonValue(reviewed),
      },
    });

    await tx.agentConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return saved;
  });

  return proposalFromRecord(updated);
}

function resolveCustomerIdFromCustomer(
  customer: DispatchProposal["customer"] | DispatchProposalPayload["customer"],
): string | undefined {
  if (customer.matchedCustomerId) {
    return customer.matchedCustomerId;
  }

  if (customer.status === "matched" && customer.matches?.length === 1) {
    return customer.matches[0]?.id;
  }

  return undefined;
}

function resolveCustomerIdFromProposal(proposal: DispatchProposal): string | undefined {
  return resolveCustomerIdFromCustomer(proposal.customer);
}

function resolveMembershipIdFromProposal(proposal: DispatchProposal): string | undefined {
  if (proposal.assigneeDraft?.membershipId) {
    return proposal.assigneeDraft.membershipId;
  }

  if (proposal.assigneeDraft?.status === "matched" && proposal.assigneeDraft.matches?.length === 1) {
    return proposal.assigneeDraft.matches[0]?.membershipId;
  }

  return undefined;
}

function isCreateCustomerOnlyIntent(intent: string): boolean {
  return intent.trim().toLowerCase() === "create_customer";
}

function isCustomerOnlyProposal(proposal: ProposalJobTargetInput & { type?: AgentProposalType }) {
  return (
    isCreateCustomerOnlyIntent(proposal.intent) ||
    proposal.type === "CREATE_CUSTOMER" ||
    proposal.type === "UPDATE_CUSTOMER"
  );
}

function isUpdateExistingJobIntent(intent: string): boolean {
  return intent.trim().toLowerCase() === "update_existing_job";
}

function hasSchedulingOrAssignmentIntent(proposal: ProposalJobTargetInput): boolean {
  return Boolean(
    proposal.assigneeDraft?.status === "matched" ||
      proposal.scheduleDraft.scheduledStartAt ||
      proposal.scheduleDraft.scheduledEndAt,
  );
}

const jobConceptPatterns = [
  ["leak", /leak|漏水|渗漏|漏/iu],
  ["tap", /\btaps?\b|\bfaucets?\b|水龙头|龙头/iu],
  ["kitchen", /\bkitchen\b|厨房/iu],
  ["dishwasher", /\bdish\s*washer\b|\bdishwasher\b|洗碗机/iu],
  ["investigation", /investigat|inspect|diagnos|调查|检查/iu],
  ["installation", /install|安装/iu],
  ["ceiling", /\bceiling\b|天花板|吊顶/iu],
  ["fan", /\bfans?\b|风扇|吊扇/iu],
  ["aircon", /\bair\s*con\b|\bac\b|\bair\s*condition|空调/iu],
  ["maintenance", /mainten|service|维护|保养/iu],
] satisfies Array<[string, RegExp]>;

const comparableTokenStopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "job",
  "work",
  "repair",
  "repairs",
  "service",
  "services",
]);

function proposalJobText(proposal: ProposalJobTargetInput): string {
  return `${proposal.jobDraft.title} ${proposal.jobDraft.description ?? ""}`;
}

function normalizeComparableText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractComparableTokens(value: string): Set<string> {
  const tokens = value.toLowerCase().match(/[a-z0-9]+/gu) ?? [];

  return new Set(
    tokens
      .map((token) => token.replace(/(?:ing|ed|s)$/u, ""))
      .filter((token) => token.length >= 3 && !comparableTokenStopWords.has(token)),
  );
}

function extractJobConcepts(value: string): Set<string> {
  const concepts = new Set<string>();

  for (const [concept, pattern] of jobConceptPatterns) {
    if (pattern.test(value)) {
      concepts.add(concept);
    }
  }

  return concepts;
}

function intersectionSize(left: Set<string>, right: Set<string>): number {
  let count = 0;

  for (const item of left) {
    if (right.has(item)) {
      count += 1;
    }
  }

  return count;
}

function looksLikeSameJob(
  job: { title: string; description: string | null },
  proposal: ProposalJobTargetInput,
): boolean {
  const jobText = `${job.title} ${job.description ?? ""}`;
  const draftText = proposalJobText(proposal);
  const normalizedJobText = normalizeComparableText(jobText);
  const normalizedDraftText = normalizeComparableText(draftText);

  if (
    normalizedJobText.length >= 8 &&
    normalizedDraftText.length >= 8 &&
    (normalizedJobText.includes(normalizedDraftText) ||
      normalizedDraftText.includes(normalizedJobText))
  ) {
    return true;
  }

  const sharedConcepts = intersectionSize(
    extractJobConcepts(jobText),
    extractJobConcepts(draftText),
  );
  const sharedTokens = intersectionSize(
    extractComparableTokens(jobText),
    extractComparableTokens(draftText),
  );

  return sharedConcepts >= 2 || sharedTokens >= 2 || (sharedConcepts >= 1 && sharedTokens >= 1);
}

function formatExistingJobCandidate(job: {
  id: string;
  title: string;
  serviceAddress?: string;
  status: JobStatus;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
  assignedTo: { displayName: string } | null;
  customer?: { id: string; name: string };
}) {
  return {
    id: job.id,
    title: job.title,
    ...(job.serviceAddress ? { serviceAddress: job.serviceAddress } : {}),
    status: job.status,
    scheduledStartAt: job.scheduledStartAt?.toISOString() ?? null,
    scheduledEndAt: job.scheduledEndAt?.toISOString() ?? null,
    assignedToName: job.assignedTo?.displayName ?? null,
    ...(job.customer ? { customer: job.customer } : {}),
  };
}

async function findExistingJobCandidatesForReview(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  proposal: ProposalJobTargetInput & { type?: AgentProposalType; target?: { jobId?: string } },
) {
  if (isCustomerOnlyProposal(proposal)) {
    return [];
  }

  const customerId = resolveCustomerIdFromCustomer(proposal.customer);
  const existingJobId = proposal.jobDraft.existingJobId ?? proposal.target?.jobId;

  if (existingJobId) {
    const job = await tx.job.findFirst({
      where: {
        id: existingJobId,
        tenantId: auth.tenantId,
      },
      select: {
        id: true,
        title: true,
        serviceAddress: true,
        status: true,
        customerId: true,
        scheduledStartAt: true,
        scheduledEndAt: true,
        assignedTo: {
          select: {
            displayName: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!job) {
      throw new ApiError(
        400,
        "The selected existing job is no longer available. Re-search jobs before saving the proposal.",
      );
    }

    if (!openDispatchJobStatuses.includes(job.status)) {
      throw new ApiError(
        409,
        "Only open jobs can be updated from an AI proposal.",
        {
          code: "EXISTING_JOB_NOT_OPEN",
          job: formatExistingJobCandidate(job),
        },
      );
    }

    if (customerId && job.customerId !== customerId) {
      throw new ApiError(
        400,
        "The selected existing job belongs to a different customer. Re-search the customer and job before saving the proposal.",
        {
          code: "EXISTING_JOB_CUSTOMER_MISMATCH",
          customerId,
          job: formatExistingJobCandidate(job),
        },
      );
    }

    return [];
  }

  if (!customerId || proposal.customer.status === "new") {
    return [];
  }

  const openJobs = await tx.job.findMany({
    where: {
      tenantId: auth.tenantId,
      customerId,
      status: {
        in: openDispatchJobStatuses,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
    select: {
      id: true,
      title: true,
      description: true,
      serviceAddress: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      assignedTo: {
        select: {
          displayName: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (openJobs.length === 0) {
    return [];
  }

  const likelyMatches = openJobs.filter((job) => looksLikeSameJob(job, proposal));
  const blockingJobs =
    likelyMatches.length > 0
      ? likelyMatches
      : hasSchedulingOrAssignmentIntent(proposal) && openJobs.length === 1
        ? openJobs
        : [];

  if (blockingJobs.length === 0) {
    return [];
  }

  return blockingJobs.map(formatExistingJobCandidate);
}

async function assertProposalJobTargetIsSafe(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  proposal: ProposalJobTargetInput & { type?: AgentProposalType; target?: { jobId?: string } },
) {
  const blockingJobs = await findExistingJobCandidatesForReview(tx, auth, proposal);

  if (blockingJobs.length === 0) {
    return;
  }

  throw new ApiError(
    400,
    "This proposal appears to target an existing open job. Do not create a duplicate job; save the proposal with intent=\"update_existing_job\" and jobDraft.existingJobId.",
    {
      code: "EXISTING_JOB_REQUIRED",
      customerId: resolveCustomerIdFromCustomer(proposal.customer),
      candidateJobs: blockingJobs,
    },
  );
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isExistingJobProposalType(type?: AgentProposalType) {
  return Boolean(
    type &&
      ["UPDATE_JOB", "ASSIGN_JOB", "SCHEDULE_JOB", "CHANGE_JOB_STATUS", "CANCEL_JOB"].includes(
        type,
      ),
  );
}

function normalizeReviewCandidateJobs(
  proposal: DispatchProposalPayload,
): ProposalReviewJobCandidate[] {
  const jobs = proposal.review?.candidates?.jobs ?? [];
  const seen = new Set<string>();

  return jobs.filter((job) => {
    if (seen.has(job.id)) {
      return false;
    }

    seen.add(job.id);
    return true;
  });
}

function inferExistingJobType(proposal: DispatchProposalPayload): AgentProposalType {
  if (proposal.type && proposal.type !== "CREATE_JOB") {
    return proposal.type;
  }

  if (proposal.statusDraft?.toStatus === JobStatus.CANCELLED) {
    return "CANCEL_JOB";
  }

  if (proposal.statusDraft) {
    return "CHANGE_JOB_STATUS";
  }

  if (proposal.scheduleDraft.scheduledStartAt || proposal.scheduleDraft.scheduledEndAt) {
    return "SCHEDULE_JOB";
  }

  if (proposal.assigneeDraft?.status === "matched") {
    return "ASSIGN_JOB";
  }

  return "UPDATE_JOB";
}

async function getCustomerSnapshot(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  customerId: string | undefined,
): Promise<ProposalReviewCustomerSnapshot | undefined> {
  if (!customerId) {
    return undefined;
  }

  const customer = await tx.customer.findFirst({
    where: {
      id: customerId,
      tenantId: auth.tenantId,
      archivedAt: null,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      notes: true,
    },
  });

  if (!customer) {
    throw new ApiError(404, "Customer not found.");
  }

  return customer;
}

async function getJobSnapshot(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  jobId: string | undefined,
): Promise<ProposalReviewJobSnapshot | undefined> {
  if (!jobId) {
    return undefined;
  }

  const job = await tx.job.findFirst({
    where: {
      id: jobId,
      tenantId: auth.tenantId,
    },
    select: {
      id: true,
      title: true,
      serviceAddress: true,
      description: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      assignedTo: {
        select: {
          displayName: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!job) {
    throw new ApiError(404, "Job not found.");
  }

  if (!openDispatchJobStatuses.includes(job.status)) {
    throw new ApiError(409, "Only open jobs can be updated from an AI proposal.");
  }

  return {
    id: job.id,
    title: job.title,
    serviceAddress: job.serviceAddress,
    description: job.description,
    status: job.status,
    scheduledStartAt: job.scheduledStartAt?.toISOString() ?? null,
    scheduledEndAt: job.scheduledEndAt?.toISOString() ?? null,
    assignedToName: job.assignedTo?.displayName ?? null,
    customer: job.customer,
  };
}

async function getStaffSnapshot(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  membershipId: string | undefined,
): Promise<ProposalReviewStaffSnapshot | undefined> {
  if (!membershipId) {
    return undefined;
  }

  const membership = await tx.membership.findFirst({
    where: {
      id: membershipId,
      tenantId: auth.tenantId,
    },
    select: {
      id: true,
      userId: true,
      role: true,
      status: true,
      user: {
        select: {
          displayName: true,
          email: true,
        },
      },
    },
  });

  if (!membership) {
    throw new ApiError(404, "Membership not found.");
  }

  if (membership.status !== MembershipStatus.ACTIVE || membership.role !== MembershipRole.STAFF) {
    throw new ApiError(409, "Jobs can only be assigned to active staff members.");
  }

  return {
    membershipId: membership.id,
    userId: membership.userId,
    displayName: membership.user.displayName,
    email: membership.user.email,
  };
}

async function getScheduleConflictReview(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  proposal: DispatchProposalPayload,
  assigneeUserId: string | undefined,
) {
  const start = proposal.scheduleDraft.scheduledStartAt;
  const end = proposal.scheduleDraft.scheduledEndAt;

  if (!assigneeUserId || !start || !end) {
    return undefined;
  }

  const scheduledStartAt = new Date(start);
  const scheduledEndAt = new Date(end);

  if (
    Number.isNaN(scheduledStartAt.getTime()) ||
    Number.isNaN(scheduledEndAt.getTime()) ||
    scheduledEndAt <= scheduledStartAt
  ) {
    return undefined;
  }

  const existingJobId = proposal.jobDraft.existingJobId ?? proposal.target?.jobId;
  const conflicts = await tx.job.findMany({
    where: {
      tenantId: auth.tenantId,
      assignedToId: assigneeUserId,
      status: {
        in: [JobStatus.SCHEDULED, JobStatus.IN_PROGRESS, JobStatus.PENDING_REVIEW],
      },
      ...(existingJobId ? { id: { not: existingJobId } } : {}),
      scheduledStartAt: {
        lt: scheduledEndAt,
      },
      scheduledEndAt: {
        gt: scheduledStartAt,
      },
    },
    orderBy: {
      scheduledStartAt: "asc",
    },
    select: {
      id: true,
      title: true,
      serviceAddress: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return {
    hasConflict: conflicts.length > 0,
    conflicts: conflicts.map((job) => ({
      id: job.id,
      title: job.title,
      serviceAddress: job.serviceAddress,
      status: job.status,
      scheduledStartAt: job.scheduledStartAt!.toISOString(),
      scheduledEndAt: job.scheduledEndAt!.toISOString(),
      customer: job.customer,
    })),
  };
}

async function withProposalReview(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  proposal: DispatchProposalPayload,
): Promise<DispatchProposalPayload> {
  const existingJobCandidates = await findExistingJobCandidatesForReview(tx, auth, proposal);
  const jobCandidates = [
    ...normalizeReviewCandidateJobs(proposal),
    ...existingJobCandidates,
  ].filter((job, index, allJobs) => allJobs.findIndex((item) => item.id === job.id) === index);
  const customerId = proposal.target?.customerId ?? resolveCustomerIdFromCustomer(proposal.customer);
  const existingJobId = proposal.jobDraft.existingJobId ?? proposal.target?.jobId;
  const membershipId = resolveMembershipIdFromProposal({
    ...proposal,
    id: "",
    conversationId: "",
    tenantId: auth.tenantId,
    userId: auth.userId,
    createdAt: new Date(),
  });
  const [customerSnapshot, jobSnapshot, staffSnapshot] = await Promise.all([
    getCustomerSnapshot(tx, auth, customerId),
    getJobSnapshot(tx, auth, existingJobId),
    getStaffSnapshot(tx, auth, membershipId),
  ]);
  const scheduleConflicts = await getScheduleConflictReview(
    tx,
    auth,
    proposal,
    staffSnapshot?.userId ?? proposal.assigneeDraft?.userId,
  );
  const blockers: string[] = [];
  const reviewWarnings = proposal.warnings.filter(
    (warning) => !warning.startsWith(scheduleConflictWarningPrefix),
  );

  if (proposal.customer.status === "ambiguous") {
    blockers.push("Select the customer this proposal should use.");
  } else if (
    proposal.type === "UPDATE_CUSTOMER" &&
    !customerId
  ) {
    blockers.push("Select the customer to update.");
  } else if (
    proposal.type !== "CREATE_CUSTOMER" &&
    proposal.customer.status === "missing"
  ) {
    blockers.push("Resolve the customer before confirming.");
  }

  if (
    (isExistingJobProposalType(proposal.type) || isUpdateExistingJobIntent(proposal.intent)) &&
    !existingJobId
  ) {
    blockers.push("Select the existing job this proposal should update.");
  }

  if (
    !existingJobId &&
    jobCandidates.length > 0 &&
    (proposal.type === "CREATE_JOB" ||
      (!proposal.type &&
        !isCustomerOnlyProposal(proposal) &&
        !isUpdateExistingJobIntent(proposal.intent)))
  ) {
    blockers.push("This looks like an existing job. Select the existing job before confirming.");
  }

  if (
    proposal.assigneeDraft?.status === "ambiguous" ||
    (proposal.type === "ASSIGN_JOB" && !membershipId)
  ) {
    blockers.push("Select the staff member this proposal should assign.");
  }

  if (
    (proposal.scheduleDraft.scheduledStartAt && !proposal.scheduleDraft.scheduledEndAt) ||
    (!proposal.scheduleDraft.scheduledStartAt && proposal.scheduleDraft.scheduledEndAt)
  ) {
    blockers.push("Provide both start and end time before confirming.");
  }

  if (scheduleConflicts?.hasConflict) {
    reviewWarnings.push(`${scheduleConflictWarningPrefix}${scheduleConflicts.conflicts.length} existing job(s).`);
  }

  const uniqueWarnings = uniqueStrings(reviewWarnings);
  const review: ProposalReview = {
    status: blockers.length > 0 ? "NEEDS_RESOLUTION" : uniqueWarnings.length > 0 ? "HAS_WARNINGS" : "READY",
    blockers: uniqueStrings(blockers),
    warnings: uniqueWarnings,
    snapshots: {
      ...(customerSnapshot ? { customer: customerSnapshot } : {}),
      ...(jobSnapshot ? { job: jobSnapshot } : {}),
      ...(staffSnapshot ? { assignee: staffSnapshot } : {}),
    },
    candidates: {
      ...(proposal.customer.matches?.length ? { customers: proposal.customer.matches } : {}),
      ...(jobCandidates.length ? { jobs: jobCandidates } : {}),
      ...(proposal.assigneeDraft?.matches?.length ? { staff: proposal.assigneeDraft.matches } : {}),
    },
    ...(scheduleConflicts ? { scheduleConflicts } : {}),
  };

  return {
    ...proposal,
    warnings: uniqueWarnings,
    review,
  };
}

function normalizeOptionalMatchValue(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeOptionalTextValue(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeRequiredTextValue(value: string | null | undefined, message: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new ApiError(400, message);
  }

  return trimmed;
}

function normalizeOptionalDateTimeValue(value?: string | null): Date | null {
  const trimmed = value?.trim();
  return trimmed ? new Date(trimmed) : null;
}

function normalizeProposalSchedule(proposal: DispatchProposal) {
  const scheduledStartAt = normalizeOptionalDateTimeValue(
    proposal.scheduleDraft.scheduledStartAt,
  );
  const scheduledEndAt = normalizeOptionalDateTimeValue(
    proposal.scheduleDraft.scheduledEndAt,
  );

  if ((scheduledStartAt && !scheduledEndAt) || (!scheduledStartAt && scheduledEndAt)) {
    throw new ApiError(
      400,
      "Both start and end time are required when scheduling a job.",
    );
  }

  if (scheduledStartAt && scheduledEndAt && scheduledEndAt <= scheduledStartAt) {
    throw new ApiError(400, "End time must be after the start time.");
  }

  return {
    scheduledAt: scheduledStartAt,
    scheduledStartAt,
    scheduledEndAt,
  };
}

async function findExistingCustomerMatch(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  customer: DispatchProposal["customer"],
) {
  const email = normalizeOptionalMatchValue(customer.email)?.toLowerCase();
  const phone = normalizeOptionalMatchValue(customer.phone);

  if (!email && !phone) {
    return null;
  }

  const matches = await tx.customer.findMany({
    where: {
      tenantId: auth.tenantId,
      archivedAt: null,
      OR: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  });

  const uniqueMatches = matches.filter(
    (match, index, allMatches) =>
      allMatches.findIndex((item) => item.id === match.id) === index,
  );

  if (uniqueMatches.length === 0) {
    return null;
  }

  if (uniqueMatches.length > 1) {
    throw new ApiError(
      400,
      "This proposal matches multiple existing customers by phone or email. Please review the customer before confirming.",
    );
  }

  return uniqueMatches[0];
}

async function resolveCustomerForConfirmation(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  proposal: DispatchProposal,
) {
  let resolvedCustomerId = resolveCustomerIdFromProposal(proposal);
  let resolvedCustomerName: string | undefined;
  let usedExistingCustomer = false;

  if (resolvedCustomerId) {
    const customer = await tx.customer.findFirst({
      where: {
        id: resolvedCustomerId,
        tenantId: auth.tenantId,
        archivedAt: null,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!customer) {
      throw new ApiError(
        400,
        "The matched customer is no longer available. Please ask the AI to re-check the customer.",
      );
    }

    resolvedCustomerId = customer.id;
    resolvedCustomerName = customer.name;
  }

  const existingCustomerMatch = resolvedCustomerId
    ? null
    : await findExistingCustomerMatch(tx, auth, proposal.customer);

  if (!resolvedCustomerId && existingCustomerMatch) {
    resolvedCustomerId = existingCustomerMatch.id;
    resolvedCustomerName = existingCustomerMatch.name;
    usedExistingCustomer = true;
  } else if (
    !resolvedCustomerId &&
    !(proposal.customer.status === "new" && proposal.customer.name?.trim())
  ) {
    throw new ApiError(
      400,
      "This proposal does not have a confirmed customer. Please resolve the customer match first.",
    );
  }

  if (resolvedCustomerId) {
    return {
      customerId: resolvedCustomerId,
      customerName:
        resolvedCustomerName ??
        proposal.customer.name?.trim() ??
        proposal.customer.matches?.[0]?.name,
      usedExistingCustomer,
    };
  }

  const createdCustomer = await tx.customer.create({
    data: {
      tenantId: auth.tenantId,
      createdById: auth.userId,
      name: proposal.customer.name!.trim(),
      phone: normalizeOptionalTextValue(proposal.customer.phone),
      email: normalizeOptionalTextValue(proposal.customer.email),
      notes: normalizeOptionalTextValue(proposal.customer.notes),
    },
    select: {
      id: true,
      name: true,
    },
  });

  return {
    customerId: createdCustomer.id,
    customerName: createdCustomer.name,
    usedExistingCustomer,
  };
}

async function createJobForConfirmation(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  proposal: DispatchProposal,
  customerId: string,
) {
  const scheduling = normalizeProposalSchedule(proposal);

  return tx.job.create({
    data: {
      tenantId: auth.tenantId,
      customerId,
      title: proposal.jobDraft.title.trim(),
      serviceAddress: normalizeRequiredTextValue(
        proposal.jobDraft.serviceAddress,
        "Service address is required before creating a job.",
      ),
      description: normalizeOptionalTextValue(proposal.jobDraft.description),
      ...scheduling,
      createdById: auth.userId,
      status: JobStatus.NEW,
    },
    select: {
      id: true,
      title: true,
      assignedToId: true,
    },
  });
}

async function getExistingJobForConfirmation(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  jobId: string,
) {
  const job = await tx.job.findFirst({
    where: {
      id: jobId,
      tenantId: auth.tenantId,
    },
    select: {
      id: true,
      title: true,
      serviceAddress: true,
      description: true,
      status: true,
      assignedToId: true,
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!job) {
    throw new ApiError(
      404,
      "The selected job is no longer available. Please ask the AI to re-check the job.",
    );
  }

  return job;
}

async function updateExistingJobScheduleForConfirmation(
  tx: Prisma.TransactionClient,
  proposal: DispatchProposal,
  job: { id: string },
) {
  const hasScheduleDraft = Boolean(
    proposal.scheduleDraft.scheduledStartAt || proposal.scheduleDraft.scheduledEndAt,
  );

  if (!hasScheduleDraft) {
    return;
  }

  const scheduling = normalizeProposalSchedule(proposal);

  await tx.job.update({
    where: {
      id: job.id,
    },
    data: scheduling,
  });
}

async function updateExistingJobDraftForConfirmation(
  tx: Prisma.TransactionClient,
  proposal: DispatchProposal,
  job: { id: string },
) {
  const data: Prisma.JobUpdateInput = {};
  const title = proposal.jobDraft.title?.trim();
  const serviceAddress = proposal.jobDraft.serviceAddress?.trim();

  if (title) {
    data.title = title;
  }

  if (serviceAddress) {
    data.serviceAddress = serviceAddress;
  }

  if (proposal.jobDraft.description !== undefined) {
    data.description = normalizeOptionalTextValue(proposal.jobDraft.description);
  }

  if (Object.keys(data).length === 0) {
    return;
  }

  await tx.job.update({
    where: {
      id: job.id,
    },
    data,
  });
}

async function getAssignableMembershipForConfirmation(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  membershipId: string,
) {
  const membership = await tx.membership.findFirst({
    where: {
      id: membershipId,
      tenantId: auth.tenantId,
    },
    select: {
      id: true,
      userId: true,
      role: true,
      status: true,
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });

  if (!membership) {
    throw new ApiError(404, "Membership not found.");
  }

  if (
    membership.status !== MembershipStatus.ACTIVE ||
    membership.role !== MembershipRole.STAFF
  ) {
    throw new ApiError(409, "Jobs can only be assigned to active staff members.");
  }

  return membership;
}

async function assignJobForConfirmation(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  job: { id: string; title: string; assignedToId: string | null },
  membershipId: string,
) {
  const membership = await getAssignableMembershipForConfirmation(tx, auth, membershipId);

  if (job.assignedToId === membership.userId) {
    return {
      assignedToName: membership.user.displayName,
      assigneeUserId: membership.userId,
      notifications: [] as NotificationDeliveryItem[],
    };
  }

  const updated = await tx.job.update({
    where: {
      id: job.id,
    },
    data: {
      assignedToId: membership.userId,
    },
    select: {
      id: true,
      title: true,
    },
  });

  await tx.auditLog.create({
    data: {
      action: AuditAction.JOB_ASSIGNED,
      tenantId: auth.tenantId,
      userId: auth.userId,
      targetType: "job",
      targetId: updated.id,
      metadata: {
        jobTitle: updated.title,
        assigneeId: membership.user.id,
        assigneeName: membership.user.displayName,
        assigneeEmail: membership.user.email,
      },
    },
  });

  const notifications = await createJobAssignedNotification(tx, {
    tenantId: auth.tenantId,
    actorUserId: auth.userId,
    recipientUserId: membership.userId,
    jobId: updated.id,
    jobTitle: updated.title,
  });

  return {
    assignedToName: membership.user.displayName,
    assigneeUserId: membership.userId,
    notifications,
  };
}

async function scheduleJobForConfirmation(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  job: { id: string; title: string },
  recipientUserId: string,
) {
  const transitioned = await transitionJobStatusInTransaction(tx, {
    tenantId: auth.tenantId,
    jobId: job.id,
    toStatus: JobStatus.SCHEDULED,
    changedById: auth.userId,
  });

  const notifications = await createJobStatusChangedNotification(tx, {
    tenantId: auth.tenantId,
    actorUserId: auth.userId,
    recipientUserId,
    jobId: job.id,
    jobTitle: job.title,
    fromStatus: transitioned.history.fromStatus,
    toStatus: transitioned.history.toStatus,
  });

  return {
    transitionedTo: transitioned.history.toStatus,
    notifications,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

async function markProposalFailed(proposalId: string, message: string) {
  await prisma.agentProposal.update({
    where: { id: proposalId },
    data: {
      status: AgentProposalStatus.FAILED,
      failureMessage: message,
      confirmationResult: toJsonValue({ error: true, message }),
    },
  });
}

async function completeProposalConfirmationInTransaction(
  tx: Prisma.TransactionClient,
  proposalId: string,
  confirmedById: string,
  result: ConfirmedProposalResult,
  conversationId: string,
  assistantMessage: string,
) {
  await tx.agentProposal.update({
    where: { id: proposalId },
    data: {
      status: AgentProposalStatus.CONFIRMED,
      confirmedById,
      confirmedAt: new Date(),
      confirmationResult: toJsonValue(result),
      failureMessage: null,
    },
  });

  await tx.agentMessage.create({
    data: {
      conversationId,
      role: AgentMessageRole.ASSISTANT,
      content: assistantMessage,
    },
  });

  await tx.agentConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}

async function publishConfirmationNotifications(
  notifications: NotificationDeliveryItem[],
) {
  if (notifications.length === 0) {
    return;
  }

  try {
    await publishCreatedNotifications(notifications);
  } catch (error) {
    console.error("Failed to publish agent confirmation notifications", error);
  }
}

function confirmationFailureMessage(error: unknown) {
  return `Dispatch proposal confirmation failed. No customer or job was created or updated. ${errorMessage(error)}`;
}

function rethrowConfirmationFailure(error: unknown, message: string): never {
  if (error instanceof ApiError) {
    throw new ApiError(error.statusCode, message, error.details);
  }

  throw new ApiError(500, message);
}

function existingJobIdFromProposal(proposal: DispatchProposal): string | undefined {
  return proposal.jobDraft.existingJobId ?? proposal.target?.jobId;
}

function customerIdFromProposalTarget(proposal: DispatchProposal): string | undefined {
  return proposal.target?.customerId ?? resolveCustomerIdFromProposal(proposal);
}

async function confirmCustomerUpdateInTransaction(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  proposal: DispatchProposal,
  conversationId: string,
) {
  const customerId = customerIdFromProposalTarget(proposal);

  if (!customerId) {
    throw new ApiError(400, "Customer update proposals require a target customer.");
  }

  const customer = await tx.customer.findFirst({
    where: {
      id: customerId,
      tenantId: auth.tenantId,
      archivedAt: null,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      notes: true,
    },
  });

  if (!customer) {
    throw new ApiError(404, "Customer not found.");
  }

  if (!proposal.changes?.length) {
    throw new ApiError(400, "Customer update proposals require at least one change.");
  }

  const data: Prisma.CustomerUpdateInput = {};

  for (const change of proposal.changes) {
    if (change.field === "name") {
      data.name = normalizeRequiredTextValue(change.to, "Customer name is required.");
    } else {
      data[change.field] = normalizeOptionalTextValue(change.to);
    }
  }

  const updated = await tx.customer.update({
    where: { id: customer.id },
    data,
    select: {
      id: true,
      name: true,
    },
  });

  const result: ConfirmedProposalResult = {
    proposalId: proposal.id,
    proposalType: proposal.type,
    entityType: "customer",
    updatedCustomerId: updated.id,
    updatedCustomerName: updated.name,
    createdCustomerId: updated.id,
    createdCustomerName: updated.name,
    usedExistingCustomer: true,
  };

  await completeProposalConfirmationInTransaction(
    tx,
    proposal.id,
    auth.userId,
    result,
    conversationId,
    `Plan confirmed. Updated customer **${updated.name}**.`,
  );

  return {
    result,
    notifications: [] as NotificationDeliveryItem[],
  };
}

async function confirmTypedCreateCustomerInTransaction(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  proposal: DispatchProposal,
  conversationId: string,
) {
  const customer = await resolveCustomerForConfirmation(tx, auth, proposal);
  const result: ConfirmedProposalResult = {
    proposalId: proposal.id,
    proposalType: proposal.type,
    entityType: "customer",
    createdCustomerId: customer.customerId,
    ...(customer.customerName ? { createdCustomerName: customer.customerName } : {}),
    ...(customer.usedExistingCustomer ? { usedExistingCustomer: true } : {}),
  };

  await completeProposalConfirmationInTransaction(
    tx,
    proposal.id,
    auth.userId,
    result,
    conversationId,
    customer.usedExistingCustomer
      ? `Plan confirmed. Reused existing customer **${customer.customerName ?? "Existing customer"}**.`
      : `Plan confirmed. Created customer **${customer.customerName ?? "New customer"}**.`,
  );

  return {
    result,
    notifications: [] as NotificationDeliveryItem[],
  };
}

async function confirmTypedCreateJobInTransaction(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  proposal: DispatchProposal,
  conversationId: string,
) {
  const customer = await resolveCustomerForConfirmation(tx, auth, proposal);
  const membershipId = resolveMembershipIdFromProposal(proposal);
  const shouldAssign = proposal.assigneeDraft?.status === "matched" && membershipId;
  const shouldSchedule =
    shouldAssign &&
    proposal.scheduleDraft.scheduledStartAt &&
    proposal.scheduleDraft.scheduledEndAt;
  const notifications: NotificationDeliveryItem[] = [];
  const createdJob = await createJobForConfirmation(
    tx,
    auth,
    proposal,
    customer.customerId,
  );
  let assignedToName: string | undefined;
  let transitionedTo: JobStatus | undefined;

  if (shouldAssign && membershipId) {
    const assigned = await assignJobForConfirmation(tx, auth, createdJob, membershipId);
    assignedToName = assigned.assignedToName;
    notifications.push(...assigned.notifications);

    if (shouldSchedule) {
      const scheduled = await scheduleJobForConfirmation(
        tx,
        auth,
        createdJob,
        assigned.assigneeUserId,
      );
      transitionedTo = scheduled.transitionedTo;
      notifications.push(...scheduled.notifications);
    }
  }

  const result: ConfirmedProposalResult = {
    proposalId: proposal.id,
    proposalType: proposal.type,
    entityType: "job",
    ...(customer.usedExistingCustomer ? { usedExistingCustomer: true } : {}),
    createdCustomerId: customer.customerId,
    ...(customer.customerName ? { createdCustomerName: customer.customerName } : {}),
    createdJobId: createdJob.id,
    createdJobTitle: createdJob.title,
    ...(assignedToName ? { assignedToName } : {}),
    ...(transitionedTo ? { transitionedTo } : {}),
  };

  await completeProposalConfirmationInTransaction(
    tx,
    proposal.id,
    auth.userId,
    result,
    conversationId,
    `Plan confirmed. Created job **${createdJob.title}**${assignedToName ? ` and assigned it to **${assignedToName}**` : ""}${transitionedTo ? `, then moved it to **${transitionedTo}**.` : "."}`,
  );

  return {
    result,
    notifications,
  };
}

async function confirmTypedExistingJobInTransaction(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  proposal: DispatchProposal,
  conversationId: string,
) {
  const existingJobId = existingJobIdFromProposal(proposal);

  if (!existingJobId) {
    throw new ApiError(400, "Existing job proposal requires a job target.");
  }

  const job = await getExistingJobForConfirmation(tx, auth, existingJobId);
  const membershipId = resolveMembershipIdFromProposal(proposal);
  const shouldAssign = proposal.assigneeDraft?.status === "matched" && membershipId;
  const shouldSchedule =
    proposal.type === "SCHEDULE_JOB" ||
    Boolean(proposal.scheduleDraft.scheduledStartAt || proposal.scheduleDraft.scheduledEndAt);
  const notifications: NotificationDeliveryItem[] = [];
  let assignedToName: string | undefined;
  let assignedToUserId = job.assignedToId ?? undefined;
  let transitionedTo: JobStatus | undefined;

  if (proposal.type === "UPDATE_JOB") {
    await updateExistingJobDraftForConfirmation(tx, proposal, job);
  }

  if (shouldSchedule) {
    await updateExistingJobScheduleForConfirmation(tx, proposal, job);
  }

  if (shouldAssign && membershipId) {
    const assigned = await assignJobForConfirmation(tx, auth, job, membershipId);
    assignedToName = assigned.assignedToName;
    assignedToUserId = assigned.assigneeUserId;
    notifications.push(...assigned.notifications);
  }

  if (
    shouldSchedule &&
    assignedToUserId &&
    job.status === JobStatus.NEW &&
    proposal.scheduleDraft.scheduledStartAt &&
    proposal.scheduleDraft.scheduledEndAt
  ) {
    const scheduled = await scheduleJobForConfirmation(tx, auth, job, assignedToUserId);
    transitionedTo = scheduled.transitionedTo;
    notifications.push(...scheduled.notifications);
  } else if (proposal.type === "CHANGE_JOB_STATUS" || proposal.type === "CANCEL_JOB") {
    const toStatus =
      proposal.type === "CANCEL_JOB"
        ? JobStatus.CANCELLED
        : proposal.statusDraft?.toStatus;

    if (!toStatus) {
      throw new ApiError(400, "Status change proposals require statusDraft.toStatus.");
    }

    const transitioned = await transitionJobStatusInTransaction(tx, {
      tenantId: auth.tenantId,
      jobId: job.id,
      toStatus,
      changedById: auth.userId,
      reason: proposal.statusDraft?.reason ?? undefined,
    });
    const statusNotifications = await createJobStatusChangedNotification(tx, {
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      recipientUserId: job.assignedToId,
      jobId: job.id,
      jobTitle: job.title,
      fromStatus: transitioned.history.fromStatus,
      toStatus: transitioned.history.toStatus,
    });
    transitionedTo = transitioned.history.toStatus;
    notifications.push(...statusNotifications);
  }

  const effectiveTitle = proposal.type === "UPDATE_JOB" && proposal.jobDraft.title
    ? proposal.jobDraft.title
    : job.title;
  const result: ConfirmedProposalResult = {
    proposalId: proposal.id,
    proposalType: proposal.type,
    entityType: "job",
    createdCustomerId: job.customer.id,
    createdCustomerName: job.customer.name,
    createdJobId: job.id,
    createdJobTitle: effectiveTitle,
    updatedExistingJob: true,
    ...(assignedToName ? { assignedToName } : {}),
    ...(transitionedTo ? { transitionedTo } : {}),
  };

  await completeProposalConfirmationInTransaction(
    tx,
    proposal.id,
    auth.userId,
    result,
    conversationId,
    `Plan confirmed. Updated job **${effectiveTitle}**${assignedToName ? ` and assigned it to **${assignedToName}**` : ""}${transitionedTo ? `, then moved it to **${transitionedTo}**.` : "."}`,
  );

  return {
    result,
    notifications,
  };
}

async function confirmTypedProposalInTransaction(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  proposal: DispatchProposal,
  conversationId: string,
) {
  switch (proposal.type) {
    case "CREATE_CUSTOMER":
      return confirmTypedCreateCustomerInTransaction(tx, auth, proposal, conversationId);
    case "UPDATE_CUSTOMER":
      return confirmCustomerUpdateInTransaction(tx, auth, proposal, conversationId);
    case "CREATE_JOB":
      return confirmTypedCreateJobInTransaction(tx, auth, proposal, conversationId);
    case "UPDATE_JOB":
    case "ASSIGN_JOB":
    case "SCHEDULE_JOB":
    case "CHANGE_JOB_STATUS":
    case "CANCEL_JOB":
      return confirmTypedExistingJobInTransaction(tx, auth, proposal, conversationId);
    default:
      throw new ApiError(400, "Unsupported proposal type.");
  }
}

export async function confirmDispatchProposal(
  auth: AuthContext,
  conversationId: string,
  proposalId: string,
): Promise<ConfirmedProposalResult> {
  if (auth.role === MembershipRole.STAFF) {
    throw new ApiError(403, "Only owners and managers can confirm dispatch plans.");
  }

  const proposalRecord = await prisma.agentProposal.findFirst({
    where: {
      id: proposalId,
      conversationId,
      tenantId: auth.tenantId,
      userId: auth.userId,
    },
  });

  if (!proposalRecord) {
    throw new ApiError(404, "Proposal not found.");
  }

  if (proposalRecord.status !== AgentProposalStatus.PENDING) {
    throw new ApiError(409, "Dispatch proposal has already been resolved.");
  }

  const proposal = proposalFromRecord(proposalRecord);
  if (proposal.review?.status === "NEEDS_RESOLUTION") {
    throw new ApiError(
      409,
      proposal.review.blockers[0] ?? "Resolve the proposal before confirming.",
      {
        code: "PROPOSAL_REVIEW_REQUIRED",
        blockers: proposal.review.blockers,
      },
    );
  }

  const locked = await prisma.agentProposal.updateMany({
    where: {
      id: proposalRecord.id,
      status: AgentProposalStatus.PENDING,
    },
    data: {
      status: AgentProposalStatus.CONFIRMING,
    },
  });

  if (locked.count !== 1) {
    throw new ApiError(409, "Dispatch proposal is already being confirmed.");
  }

  try {
    if (proposal.type) {
      const { result, notifications } = await prisma.$transaction(async (tx) => {
        await assertProposalJobTargetIsSafe(tx, auth, proposal);
        return confirmTypedProposalInTransaction(tx, auth, proposal, conversationId);
      });

      await publishConfirmationNotifications(notifications);
      return result;
    }

    const createCustomerOnly = isCreateCustomerOnlyIntent(proposal.intent);
    const updateExistingJob = isUpdateExistingJobIntent(proposal.intent);

    if (updateExistingJob && !proposal.jobDraft.existingJobId) {
      throw new ApiError(
        400,
        "Updating an existing job requires jobDraft.existingJobId. Please ask the AI to re-search and select the job.",
      );
    }

    const membershipId = resolveMembershipIdFromProposal(proposal);
    if (!createCustomerOnly && proposal.assigneeDraft?.status === "matched" && !membershipId) {
      throw new ApiError(
        400,
        "The assignee was matched but no membership ID was resolved. Please ask the AI to re-search for the staff member.",
      );
    }

    const { result, notifications } = await prisma.$transaction(async (tx) => {
      await assertProposalJobTargetIsSafe(tx, auth, proposal);

      const existingJobId = proposal.jobDraft.existingJobId;

      if (existingJobId && !createCustomerOnly) {
        const job = await getExistingJobForConfirmation(tx, auth, existingJobId);
        await updateExistingJobScheduleForConfirmation(tx, proposal, job);

        const shouldAssign = proposal.assigneeDraft?.status === "matched" && membershipId;
        const hasScheduleDraft = Boolean(
          proposal.scheduleDraft.scheduledStartAt || proposal.scheduleDraft.scheduledEndAt,
        );
        const notifications: NotificationDeliveryItem[] = [];
        let assignedToName: string | undefined;
        let assignedToUserId = job.assignedToId ?? undefined;
        let transitionedTo: JobStatus | undefined;

        if (shouldAssign && membershipId) {
          const assigned = await assignJobForConfirmation(tx, auth, job, membershipId);
          assignedToName = assigned.assignedToName;
          assignedToUserId = assigned.assigneeUserId;
          notifications.push(...assigned.notifications);
        }

        if (hasScheduleDraft && assignedToUserId) {
          if (job.status === JobStatus.NEW) {
            const scheduled = await scheduleJobForConfirmation(
              tx,
              auth,
              job,
              assignedToUserId,
            );
            transitionedTo = scheduled.transitionedTo;
            notifications.push(...scheduled.notifications);
          } else if (job.status !== JobStatus.SCHEDULED) {
            throw new ApiError(
              409,
              `Only NEW or SCHEDULED jobs can be scheduled from an AI proposal. Current status is ${job.status}.`,
            );
          }
        }

        const result: ConfirmedProposalResult = {
          proposalId: proposal.id,
          entityType: "job",
          createdCustomerId: job.customer.id,
          createdCustomerName: job.customer.name,
          createdJobId: job.id,
          createdJobTitle: job.title,
          updatedExistingJob: true,
          ...(assignedToName ? { assignedToName } : {}),
          ...(transitionedTo ? { transitionedTo } : {}),
        };

        await completeProposalConfirmationInTransaction(
          tx,
          proposal.id,
          auth.userId,
          result,
          conversationId,
          `Plan confirmed. Updated job **${job.title}**${assignedToName ? ` and assigned it to **${assignedToName}**` : ""}${transitionedTo ? `, then moved it to **${transitionedTo}**.` : "."}`,
        );

        return {
          result,
          notifications,
        };
      }

      const customer = await resolveCustomerForConfirmation(tx, auth, proposal);

      if (createCustomerOnly) {
        const result: ConfirmedProposalResult = {
          proposalId: proposal.id,
          entityType: "customer",
          createdCustomerId: customer.customerId,
          ...(customer.customerName ? { createdCustomerName: customer.customerName } : {}),
          ...(customer.usedExistingCustomer ? { usedExistingCustomer: true } : {}),
        };

        await completeProposalConfirmationInTransaction(
          tx,
          proposal.id,
          auth.userId,
          result,
          conversationId,
          customer.usedExistingCustomer
            ? `Plan confirmed. Reused existing customer **${customer.customerName ?? "Existing customer"}**.`
            : `Plan confirmed. Created customer **${customer.customerName ?? "New customer"}**.`,
        );

        return {
          result,
          notifications: [] as NotificationDeliveryItem[],
        };
      }

      const shouldAssign = proposal.assigneeDraft?.status === "matched" && membershipId;
      const shouldSchedule =
        shouldAssign &&
        proposal.scheduleDraft.scheduledStartAt &&
        proposal.scheduleDraft.scheduledEndAt;
      const notifications: NotificationDeliveryItem[] = [];
      const createdJob = await createJobForConfirmation(
        tx,
        auth,
        proposal,
        customer.customerId,
      );
      let assignedToName: string | undefined;
      let transitionedTo: JobStatus | undefined;

      if (shouldAssign && membershipId) {
        const assigned = await assignJobForConfirmation(
          tx,
          auth,
          createdJob,
          membershipId,
        );
        assignedToName = assigned.assignedToName;
        notifications.push(...assigned.notifications);

        if (shouldSchedule) {
          const scheduled = await scheduleJobForConfirmation(
            tx,
            auth,
            createdJob,
            assigned.assigneeUserId,
          );
          transitionedTo = scheduled.transitionedTo;
          notifications.push(...scheduled.notifications);
        }
      }

      const result: ConfirmedProposalResult = {
        proposalId: proposal.id,
        entityType: "job",
        ...(customer.usedExistingCustomer ? { usedExistingCustomer: true } : {}),
        createdCustomerId: customer.customerId,
        ...(customer.customerName ? { createdCustomerName: customer.customerName } : {}),
        createdJobId: createdJob.id,
        createdJobTitle: createdJob.title,
        ...(assignedToName ? { assignedToName } : {}),
        ...(transitionedTo ? { transitionedTo } : {}),
      };

      await completeProposalConfirmationInTransaction(
        tx,
        proposal.id,
        auth.userId,
        result,
        conversationId,
        `Plan confirmed. Created job **${createdJob.title}**${assignedToName ? ` and assigned it to **${assignedToName}**` : ""}${transitionedTo ? `, then moved it to **${transitionedTo}**.` : "."}`,
      );

      return {
        result,
        notifications,
      };
    });

    await publishConfirmationNotifications(notifications);
    return result;
  } catch (error) {
    const message = confirmationFailureMessage(error);
    await markProposalFailed(proposal.id, message);
    rethrowConfirmationFailure(error, message);
  }
}
