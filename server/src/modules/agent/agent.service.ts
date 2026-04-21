import type Anthropic from "@anthropic-ai/sdk";
import { JobStatus, MembershipRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { AuthContext } from "../../types/auth";
import { ApiError } from "../../utils/api-error";
import { createCustomer } from "../customer/customer.service";
import {
  assignJob,
  createJob,
  transitionJobStatusForActor,
} from "../job/job.service";

export type DispatchProposal = {
  id: string;
  conversationId: string;
  tenantId: string;
  userId: string;
  intent: string;
  customer: {
    status: "matched" | "new" | "missing" | "ambiguous";
    query?: string;
    matchedCustomerId?: string;
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
    matches?: Array<{
      id: string;
      name: string;
    }>;
  };
  jobDraft: {
    title: string;
    description?: string | null;
  };
  scheduleDraft: {
    scheduledStartAt?: string | null;
    scheduledEndAt?: string | null;
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

type ConfirmedProposalResult = {
  proposalId: string;
  entityType: "customer" | "job";
  createdCustomerId?: string;
  createdCustomerName?: string;
  usedExistingCustomer?: boolean;
  createdJobId?: string;
  createdJobTitle?: string;
  assignedToName?: string;
  transitionedTo?: JobStatus;
};

const conversations = new Map<string, Conversation>();
const proposals = new Map<string, DispatchProposal>();

function cleanupExpiredState() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  for (const [id, conv] of conversations) {
    if (conv.updatedAt.getTime() < cutoff) {
      conversations.delete(id);
    }
  }

  for (const [id, proposal] of proposals) {
    if (proposal.createdAt.getTime() < cutoff) {
      proposals.delete(id);
    }
  }
}

setInterval(cleanupExpiredState, 30 * 60 * 1000);

export function createConversation(auth: AuthContext): Conversation {
  const id = crypto.randomUUID();
  const now = new Date();
  const conversation: Conversation = {
    id,
    tenantId: auth.tenantId,
    userId: auth.userId,
    messages: [],
    claudeMessages: [],
    createdAt: now,
    updatedAt: now,
  };
  conversations.set(id, conversation);
  return conversation;
}

export function getConversation(
  auth: AuthContext,
  conversationId: string,
): Conversation | null {
  const conv = conversations.get(conversationId);
  if (!conv) return null;
  if (conv.tenantId !== auth.tenantId || conv.userId !== auth.userId) return null;
  return conv;
}

export function listConversations(auth: AuthContext): ConversationSummary[] {
  const result: ConversationSummary[] = [];
  for (const conv of conversations.values()) {
    if (conv.tenantId === auth.tenantId && conv.userId === auth.userId) {
      const firstMessage = conv.messages[0];
      result.push({
        id: conv.id,
        preview: firstMessage?.content.slice(0, 100) ?? "",
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      });
    }
  }
  return result.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export function addUserMessage(
  auth: AuthContext,
  conversationId: string,
  content: string,
): ConversationMessage {
  const conv = getConversation(auth, conversationId);
  if (!conv) throw new Error("Conversation not found.");

  const message: ConversationMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content,
    createdAt: new Date(),
  };

  conv.messages.push(message);
  conv.claudeMessages.push({ role: "user", content });
  conv.updatedAt = new Date();

  return message;
}

export function storeDispatchProposal(
  auth: AuthContext,
  conversationId: string,
  input: Omit<DispatchProposal, "id" | "conversationId" | "tenantId" | "userId" | "createdAt">,
) {
  const conversation = getConversation(auth, conversationId);
  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  const proposal: DispatchProposal = {
    id: crypto.randomUUID(),
    conversationId,
    tenantId: auth.tenantId,
    userId: auth.userId,
    createdAt: new Date(),
    ...input,
  };

  proposals.set(proposal.id, proposal);
  conversation.updatedAt = new Date();
  return proposal;
}

function findLatestProposal(
  toolCalls?: Array<{ name: string; input: unknown; result: unknown }>,
): DispatchProposal | undefined {
  for (let index = (toolCalls?.length ?? 0) - 1; index >= 0; index -= 1) {
    const call = toolCalls?.[index];
    if (call?.name !== "save_dispatch_proposal") {
      continue;
    }

    const result = call.result as { proposal?: DispatchProposal } | undefined;
    if (result?.proposal) {
      return result.proposal;
    }
  }

  return undefined;
}

export function appendAssistantMessage(
  conversationId: string,
  content: string,
  claudeMessages: Anthropic.MessageParam[],
  toolCalls?: Array<{ name: string; input: unknown; result: unknown }>,
): void {
  const conv = conversations.get(conversationId);
  if (!conv) return;

  conv.messages.push({
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    toolCalls,
    proposal: findLatestProposal(toolCalls),
    createdAt: new Date(),
  });

  conv.claudeMessages = claudeMessages;
  conv.updatedAt = new Date();
}

export function appendLocalAssistantMessage(conversationId: string, content: string): void {
  const conv = conversations.get(conversationId);
  if (!conv) return;

  conv.messages.push({
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    createdAt: new Date(),
  });
  conv.updatedAt = new Date();
}

export function getProposal(
  auth: AuthContext,
  conversationId: string,
  proposalId: string,
): DispatchProposal | null {
  const proposal = proposals.get(proposalId);
  if (!proposal) return null;
  if (
    proposal.conversationId !== conversationId ||
    proposal.tenantId !== auth.tenantId ||
    proposal.userId !== auth.userId
  ) {
    return null;
  }
  return proposal;
}

function resolveCustomerIdFromProposal(proposal: DispatchProposal): string | undefined {
  if (proposal.customer.matchedCustomerId) {
    return proposal.customer.matchedCustomerId;
  }

  if (proposal.customer.status === "matched" && proposal.customer.matches?.length === 1) {
    return proposal.customer.matches[0]?.id;
  }

  return undefined;
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

function normalizeOptionalMatchValue(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

async function findExistingCustomerMatch(
  auth: AuthContext,
  customer: DispatchProposal["customer"],
) {
  const email = normalizeOptionalMatchValue(customer.email)?.toLowerCase();
  const phone = normalizeOptionalMatchValue(customer.phone);

  if (!email && !phone) {
    return null;
  }

  const matches = await prisma.customer.findMany({
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

export async function confirmDispatchProposal(
  auth: AuthContext,
  conversationId: string,
  proposalId: string,
): Promise<ConfirmedProposalResult> {
  if (auth.role === MembershipRole.STAFF) {
    throw new ApiError(403, "Only owners and managers can confirm dispatch plans.");
  }

  const proposal = getProposal(auth, conversationId, proposalId);
  if (!proposal) {
    throw new ApiError(404, "Proposal not found.");
  }

  const createCustomerOnly = isCreateCustomerOnlyIntent(proposal.intent);

  // --- Pre-flight validation: check everything before writing anything ---

  // Validate assignee before any writes
  const membershipId = resolveMembershipIdFromProposal(proposal);
  if (!createCustomerOnly && proposal.assigneeDraft?.status === "matched" && !membershipId) {
    throw new ApiError(
      400,
      "The assignee was matched but no membership ID was resolved. Please ask the AI to re-search for the staff member.",
    );
  }

  // Resolve or validate customer
  let resolvedCustomerId = resolveCustomerIdFromProposal(proposal);
  let resolvedCustomerName: string | undefined;
  let usedExistingCustomer = false;

  const existingCustomerMatch = resolvedCustomerId
    ? null
    : await findExistingCustomerMatch(auth, proposal.customer);

  if (!resolvedCustomerId && existingCustomerMatch) {
    resolvedCustomerId = existingCustomerMatch.id;
    resolvedCustomerName = existingCustomerMatch.name;
    usedExistingCustomer = true;
  } else if (!resolvedCustomerId && !(proposal.customer.status === "new" && proposal.customer.name?.trim())) {
    throw new ApiError(
      400,
      "This proposal does not have a confirmed customer. Please resolve the customer match first.",
    );
  }

  // --- All validations passed: execute writes ---

  // Create customer if needed
  let customerId = resolvedCustomerId;
  let createdCustomerName = resolvedCustomerName;

  if (!customerId) {
    const createdCustomer = await createCustomer(auth, {
      name: proposal.customer.name!.trim(),
      phone: proposal.customer.phone,
      email: proposal.customer.email,
      address: proposal.customer.address,
      notes: proposal.customer.notes,
    });
    customerId = createdCustomer.id;
    createdCustomerName = createdCustomer.name;
  }

  if (createCustomerOnly) {
    const customerName =
      createdCustomerName ??
      proposal.customer.name?.trim() ??
      proposal.customer.matches?.[0]?.name;

    appendLocalAssistantMessage(
      conversationId,
      usedExistingCustomer
        ? `Plan confirmed. Reused existing customer **${customerName ?? "Existing customer"}**.`
        : `Plan confirmed. Created customer **${customerName ?? "New customer"}**.`,
    );

    const conversation = conversations.get(conversationId);
    if (conversation) {
      conversation.messages = conversation.messages.map((message) =>
        message.proposal?.id === proposal.id
          ? { ...message, proposal: undefined }
          : message,
      );
    }

    proposals.delete(proposal.id);

    return {
      proposalId: proposal.id,
      entityType: "customer",
      createdCustomerId: customerId,
      ...(customerName ? { createdCustomerName: customerName } : {}),
      ...(usedExistingCustomer ? { usedExistingCustomer } : {}),
    };
  }

  // Create job and optionally assign, wrapped in a transaction
  const shouldAssign = proposal.assigneeDraft?.status === "matched" && membershipId;
  const shouldSchedule =
    shouldAssign &&
    proposal.scheduleDraft.scheduledStartAt &&
    proposal.scheduleDraft.scheduledEndAt;

  const createdJob = await createJob(auth, {
    customerId,
    title: proposal.jobDraft.title,
    description: proposal.jobDraft.description ?? undefined,
    scheduledStartAt: proposal.scheduleDraft.scheduledStartAt ?? undefined,
    scheduledEndAt: proposal.scheduleDraft.scheduledEndAt ?? undefined,
  });

  let assignedToName: string | undefined;
  let transitionedTo: JobStatus | undefined;

  if (shouldAssign && membershipId) {
    try {
      const assigned = await assignJob(auth, createdJob.id, { membershipId });
      assignedToName = assigned.assignedTo?.displayName;

      if (shouldSchedule) {
        await transitionJobStatusForActor(auth, createdJob.id, { toStatus: JobStatus.SCHEDULED });
        transitionedTo = JobStatus.SCHEDULED;
      }
    } catch (assignError) {
      // Assignment failed after job creation — surface the error but keep the created job
      const message = assignError instanceof Error ? assignError.message : "Assignment failed.";
      throw new ApiError(
        500,
        `Job was created (ID: ${createdJob.id}) but assignment failed: ${message}. You can assign the staff member manually.`,
      );
    }
  }

  appendLocalAssistantMessage(
    conversationId,
    `Plan confirmed. Created job **${createdJob.title}**${assignedToName ? ` and assigned it to **${assignedToName}**` : ""}${transitionedTo ? `, then moved it to **${transitionedTo}**.` : "."}`,
  );

  const conversation = conversations.get(conversationId);
  if (conversation) {
    conversation.messages = conversation.messages.map((message) =>
      message.proposal?.id === proposal.id
        ? { ...message, proposal: undefined }
        : message,
    );
  }

  proposals.delete(proposal.id);

  return {
    proposalId: proposal.id,
    entityType: "job",
    ...(usedExistingCustomer ? { usedExistingCustomer } : {}),
    ...(customerId ? { createdCustomerId: customerId } : {}),
    ...(createdCustomerName ? { createdCustomerName } : {}),
    createdJobId: createdJob.id,
    createdJobTitle: createdJob.title,
    ...(assignedToName ? { assignedToName } : {}),
    ...(transitionedTo ? { transitionedTo } : {}),
  };
}
