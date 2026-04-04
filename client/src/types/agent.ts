export type ChatMessageRole = "user" | "assistant";

export type DispatchProposal = {
  id: string;
  conversationId: string;
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
  createdAt: string;
};

export type ChatToolCall = {
  name: string;
  input: unknown;
  result: unknown;
};

export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  toolCalls?: ChatToolCall[];
  proposal?: DispatchProposal;
  createdAt: string;
};

export type ConversationSummary = {
  id: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
};

export type ConversationDetail = {
  id: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

export type ConfirmProposalResult = {
  proposalId: string;
  entityType: "customer" | "job";
  createdCustomerId?: string;
  createdCustomerName?: string;
  usedExistingCustomer?: boolean;
  createdJobId?: string;
  createdJobTitle?: string;
  assignedToName?: string;
  transitionedTo?: string;
};

export type SSEEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_use"; tool: string; input: unknown }
  | { type: "tool_result"; tool: string; result: unknown }
  | { type: "proposal"; proposal: DispatchProposal }
  | { type: "error"; message: string }
  | { type: "done" };
