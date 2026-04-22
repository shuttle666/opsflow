export type ChatMessageRole = "user" | "assistant";

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

export type DispatchProposal = {
  id: string;
  conversationId: string;
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
    toStatus: string;
    reason?: string | null;
  };
  changes?: AgentProposalChange[];
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
  transitionedTo?: string;
};

export type SSEEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_use"; tool: string; input: unknown }
  | { type: "tool_result"; tool: string; result: unknown }
  | { type: "proposal"; proposal: DispatchProposal }
  | { type: "error"; message: string }
  | { type: "done" };
