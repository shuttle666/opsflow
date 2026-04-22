"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  History,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  type IconComponent,
} from "@/components/ui/icons";
import { LoadingPanel } from "@/components/ui/loading-panel";
import {
  cn,
  primaryButtonClassName,
  surfaceClassName,
} from "@/components/ui/styles";
import { confirmProposalRequest, consumeMessageStream, createConversationRequest, getConversationRequest, listConversationsRequest, openMessageStreamRequest } from "@/features/agent";
import { formatScheduleRange } from "@/features/job";
import { useAuthStore } from "@/store/auth-store";
import type {
  ChatMessage,
  ConfirmProposalResult,
  ConversationSummary,
  DispatchProposal,
} from "@/types/agent";

type ActiveToolCall = {
  name: string;
  input: unknown;
  result?: unknown;
  status: "running" | "done";
};

const TOOL_LABELS: Record<string, string> = {
  classify_intent: "Classifying request",
  resolve_customer_target: "Resolving customer",
  resolve_job_target: "Resolving job",
  resolve_staff_target: "Resolving staff",
  resolve_time_window: "Resolving time",
  list_jobs: "Searching jobs",
  get_job_detail: "Loading job detail",
  list_customers: "Searching customers",
  get_customer_detail: "Loading customer detail",
  list_memberships: "Searching staff",
  list_activity_feed: "Checking activity",
  check_schedule_conflicts: "Checking schedule conflicts",
  save_dispatch_proposal: "Saving dispatch plan",
  save_typed_proposal: "Saving typed plan",
};

const PLANNER_SUGGESTIONS = [
  "Assign Archie Wright's dishwasher leak job to Alex Nguyen tomorrow 9-11",
  "Which unassigned jobs should be scheduled tomorrow?",
  "Update Leo Martin's phone to 0412 999 888",
  "Show Harper Lee's workload this week",
];

const PLANNER_CAPABILITIES: Array<{
  title: string;
  description: string;
  icon: IconComponent;
}> = [
  {
    title: "Find the right record",
    description: "Match customers, jobs, and staff before drafting changes.",
    icon: Search,
  },
  {
    title: "Plan job changes",
    description: "Create jobs, update existing jobs, assign staff, and schedule time windows.",
    icon: Briefcase,
  },
  {
    title: "Check schedules",
    description: "Review staff availability, workload, and overlapping appointments.",
    icon: Calendar,
  },
  {
    title: "Keep control",
    description: "Prepare confirm-first proposals for owners and managers to approve.",
    icon: ShieldCheck,
  },
];

const agentHeaderButtonClassName =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-3 text-[12px] font-semibold text-[var(--color-brand)] shadow-sm transition hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)] disabled:cursor-not-allowed disabled:opacity-50";

const composerInputClassName =
  "h-9 min-w-0 flex-1 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-3.5 text-[13px] text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus:ring-[3px] focus:ring-[var(--color-brand-soft)] disabled:cursor-not-allowed disabled:opacity-60";

const composerSendButtonClassName =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand)] text-white shadow-[0_4px_16px_-10px_var(--color-brand-glow)] transition hover:bg-[var(--color-brand-strong)] disabled:cursor-not-allowed disabled:opacity-50";

function canUsePlanner(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

function latestProposal(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const proposal = messages[index]?.proposal;
    if (proposal) {
      return proposal;
    }
  }
  return null;
}

const ACTIVE_CONVERSATION_STORAGE_PREFIX = "opsflow:agent:activeConversation";

function activeConversationStorageKey(userId: string | undefined, tenantId: string | undefined) {
  if (!userId || !tenantId) {
    return null;
  }

  return `${ACTIVE_CONVERSATION_STORAGE_PREFIX}:${tenantId}:${userId}`;
}

function readActiveConversationId(storageKey: string | null) {
  if (!storageKey || typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function writeActiveConversationId(storageKey: string | null, conversationId: string) {
  if (!storageKey || typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(storageKey, conversationId);
  } catch {
    // Session storage can be unavailable in restricted browser modes.
  }
}

function removeActiveConversationId(storageKey: string | null) {
  if (!storageKey || typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Session storage can be unavailable in restricted browser modes.
  }
}

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const date = new Date(dateString).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateString).toLocaleDateString();
}

function AiAvatar() {
  return (
    <div className="mt-0.5 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-[image:var(--gradient-brand)] text-[11px] font-extrabold text-white shadow-[0_2px_8px_var(--color-brand-glow)]">
      AI
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex flex-row-reverse gap-2.5 pl-4 sm:pl-12">
        <div className="max-w-[92%] rounded-[14px] rounded-br px-4 py-3 text-[13px] leading-relaxed text-white shadow-[0_2px_8px_var(--color-brand-glow)] sm:max-w-[84%] lg:max-w-[78%] xl:max-w-[74%]" style={{ background: "var(--color-brand)" }}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 pr-4 sm:pr-12">
      <AiAvatar />
      <div className="max-w-[92%] rounded-[14px] rounded-bl bg-[var(--color-app-panel-muted)] px-4 py-3 text-[13px] leading-relaxed text-[var(--color-text)] sm:max-w-[84%] lg:max-w-[78%] xl:max-w-[74%]">
        <div className="agent-markdown">
          <Markdown>{message.content}</Markdown>
        </div>
      </div>
    </div>
  );
}

function ToolCallIndicator({ toolCall }: { toolCall: ActiveToolCall }) {
  const label = TOOL_LABELS[toolCall.name] ?? toolCall.name;
  const done = toolCall.status === "done";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-1 text-[11px] font-medium",
        done
          ? "border-[var(--color-app-border)] bg-[var(--color-success-soft)] text-[var(--color-success)]"
          : "border-[var(--color-app-border)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          done ? "bg-[var(--color-success)]" : "animate-pulse bg-[var(--color-brand)]",
        )}
      />
      {label}
    </div>
  );
}

function ProposalCard({
  proposal,
  onConfirm,
  confirming,
  result,
}: {
  proposal: DispatchProposal;
  onConfirm: () => void;
  confirming: boolean;
  result: ConfirmProposalResult | null;
}) {
  const proposalType = proposal.type ?? (
    proposal.intent === "create_customer"
      ? "CREATE_CUSTOMER"
      : proposal.jobDraft.existingJobId
        ? "UPDATE_JOB"
        : "CREATE_JOB"
  );
  const isCustomerOnly = proposalType === "CREATE_CUSTOMER" || proposalType === "UPDATE_CUSTOMER";
  const isCustomerUpdate = proposalType === "UPDATE_CUSTOMER";
  const isExistingJobUpdate = Boolean(proposal.jobDraft.existingJobId);
  const proposalTitle = isCustomerUpdate
    ? `Update customer: ${proposal.customer.name ?? proposal.customer.query ?? "Customer"}`
    : isCustomerOnly
      ? `Create customer: ${proposal.customer.name ?? "New customer"}`
      : proposal.jobDraft.title;

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] shadow-[var(--shadow-panel)]">
      <div className="border-b border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase text-[var(--color-brand)]">
              {proposalType.replaceAll("_", " ")} Proposal
            </p>
            <h3 className="mt-1 text-lg font-bold text-[var(--color-text)]">
              {proposalTitle}
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {isExistingJobUpdate ? "Update existing job - " : ""}
              Confidence {(proposal.confidence * 100).toFixed(0)}%
            </p>
          </div>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className={primaryButtonClassName}
          >
            {confirming ? "Confirming..." : "Confirm plan"}
          </button>
        </div>
      </div>

      <div className="p-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-4">
          <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
            Customer
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">
            {proposal.customer.status === "matched"
              ? proposal.customer.matches?.[0]?.name ?? proposal.customer.query ?? "Matched customer"
              : proposal.customer.name ?? proposal.customer.query ?? "Customer to be resolved"}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Status: {proposal.customer.status}
          </p>
          {proposal.customer.phone ? (
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Phone: {proposal.customer.phone}</p>
          ) : null}
          {proposal.customer.email ? (
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Email: {proposal.customer.email}</p>
          ) : null}
        </div>

        <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-4">
          <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
            {isCustomerUpdate ? "Profile changes" : isCustomerOnly ? "Intent" : "Schedule"}
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">
            {isCustomerUpdate
              ? `${proposal.changes?.length ?? 0} field${proposal.changes?.length === 1 ? "" : "s"}`
              : isCustomerOnly
              ? "Create customer record"
              : formatScheduleRange(
                  proposal.scheduleDraft.scheduledStartAt ?? null,
                  proposal.scheduleDraft.scheduledEndAt ?? null,
                )}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {isCustomerUpdate
              ? `Proposal type: ${proposalType}`
              : isCustomerOnly
              ? `Proposal type: ${proposal.intent}`
              : `Timezone: ${proposal.scheduleDraft.timezone}`}
          </p>
          {isCustomerUpdate && proposal.changes?.length ? (
            <div className="mt-2 space-y-1 text-sm text-[var(--color-text-secondary)]">
              {proposal.changes.map((change) => (
                <p key={change.field}>
                  <span className="font-semibold text-[var(--color-text)]">{change.field}</span>
                  {": "}
                  {change.from ?? "blank"} {"->"} {change.to ?? "blank"}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-4">
          <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
            {isCustomerOnly ? "Customer details" : "Assignee"}
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">
            {isCustomerUpdate
              ? proposal.customer.phone ?? proposal.customer.email ?? "Existing customer"
              : isCustomerOnly
              ? proposal.customer.phone ?? proposal.customer.email ?? "No contact details provided"
              : proposal.assigneeDraft?.displayName ?? "Unassigned"}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {isCustomerOnly
              ? proposal.customer.notes ?? "No extra notes"
              : `Status: ${proposal.assigneeDraft?.status ?? "missing"}`}
          </p>
        </div>

        <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-4">
          <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
            {isCustomerOnly ? "Job draft" : "Service address"}
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {isCustomerUpdate
              ? "Confirming this proposal updates the customer profile only."
              : isCustomerOnly
              ? "No job will be created. Confirming this proposal creates only the customer record."
              : proposal.jobDraft.serviceAddress?.trim() ||
                (proposal.jobDraft.existingJobId
                  ? "Existing job address unchanged."
                  : "No service address provided.")}
          </p>
          {!isCustomerOnly && proposal.jobDraft.existingJobId ? (
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Confirming this proposal updates the existing job instead of creating a duplicate.
            </p>
          ) : null}
          {!isCustomerOnly && proposal.jobDraft.description?.trim() ? (
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {proposal.jobDraft.description}
            </p>
          ) : null}
        </div>
      </div>

      {proposal.warnings.length > 0 ? (
        <div className="mt-4 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-warning-soft)] p-4">
          <p className="text-xs font-semibold uppercase text-[var(--color-warning)]">
            Warnings
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-text)]">
            {proposal.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-success-soft)] p-4 text-sm text-[var(--color-success)]">
          {result.entityType === "customer" ? (
            <>
              {result.updatedCustomerId ? "Updated" : result.usedExistingCustomer ? "Reused" : "Created"} <strong>{result.updatedCustomerName ?? result.createdCustomerName ?? "customer"}</strong>.
              {" "}
              {result.updatedCustomerId ?? result.createdCustomerId ? (
                <Link href={`/customers/${result.updatedCustomerId ?? result.createdCustomerId}`} className="font-semibold underline">
                  Open customer
                </Link>
              ) : null}
            </>
          ) : (
            <>
              {result.updatedExistingJob ? "Updated" : "Created"} <strong>{result.createdJobTitle}</strong>.
              {" "}
              {result.createdJobId ? (
                <Link href={`/jobs/${result.createdJobId}`} className="font-semibold underline">
                  Open job
                </Link>
              ) : null}
            </>
          )}
        </div>
      ) : null}
      </div>
    </div>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion?: (suggestion: string) => void }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-brand-soft)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-brand)]">
            <Sparkles className="h-3.5 w-3.5" />
            AI Planner
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-normal text-[var(--color-text)] sm:text-3xl">
            Dispatch planning with your live workspace data
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--color-text-secondary)]">
            Ask for operational help in plain language. The planner checks records, resolves targets, and drafts changes for approval.
          </p>
        </div>

        <div className="grid min-w-[240px] grid-cols-2 gap-2 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-3">
          <div className="rounded-lg bg-[var(--color-app-panel)] px-3 py-2">
            <p className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
              Mode
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">
              Confirm-first
            </p>
          </div>
          <div className="rounded-lg bg-[var(--color-app-panel)] px-3 py-2">
            <p className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
              Scope
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">
              Ops planning
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PLANNER_CAPABILITIES.map((capability) => {
          const Icon = capability.icon;

          return (
            <div
              key={capability.title}
              className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-4"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-app-panel)] text-[var(--color-brand)]">
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-[var(--color-text)]">
                {capability.title}
              </h3>
              <p className="mt-1 text-[13px] leading-5 text-[var(--color-text-secondary)]">
                {capability.description}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        {onSuggestion ? (
          <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
              <h3 className="text-sm font-semibold text-[var(--color-text)]">
                Start with a task
              </h3>
            </div>
            <div className="mt-3 grid gap-2">
              {PLANNER_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onSuggestion(suggestion)}
                  className="group flex min-h-10 items-center justify-between gap-3 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-3.5 py-2 text-left text-[13px] font-medium text-[var(--color-text)] transition hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]"
                >
                  <span>{suggestion}</span>
                  <Send className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] transition group-hover:text-[var(--color-brand)]" />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--color-brand)]" />
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              Good for
            </h3>
          </div>
          <div className="mt-3 space-y-2 text-[13px] leading-5 text-[var(--color-text-secondary)]">
            <p>Scheduling work without double-booking staff.</p>
            <p>Updating existing jobs instead of creating duplicates.</p>
            <p>Changing customer profile details after matching the right customer.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AgentChat() {
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const userId = useAuthStore((state) => state.user?.id);
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const canUse = canUsePlanner(currentTenant?.role);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeToolCalls, setActiveToolCalls] = useState<ActiveToolCall[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingProposal, setPendingProposal] = useState<DispatchProposal | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmResult, setConfirmResult] = useState<ConfirmProposalResult | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeConversationKey = useMemo(
    () => activeConversationStorageKey(userId, currentTenant?.tenantId),
    [currentTenant?.tenantId, userId],
  );

  const rememberActiveConversation = useCallback(
    (id: string) => {
      writeActiveConversationId(activeConversationKey, id);
    },
    [activeConversationKey],
  );

  const clearActiveConversation = useCallback(() => {
    removeActiveConversationId(activeConversationKey);
  }, [activeConversationKey]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, activeToolCalls, scrollToBottom]);

  const loadConversation = useCallback(
    async (id: string, options?: { preserveConfirmResult?: boolean }) => {
      const detail = await withAccessTokenRetry((token) => getConversationRequest(token, id));
      setConversationId(id);
      rememberActiveConversation(id);
      setMessages(detail.messages);
      setPendingProposal(latestProposal(detail.messages));
      if (!options?.preserveConfirmResult) {
        setConfirmResult(null);
      }
      setStreamingText("");
      setActiveToolCalls([]);
    },
    [rememberActiveConversation, withAccessTokenRetry],
  );

  const refreshConversations = useCallback(async () => {
    try {
      const list = await withAccessTokenRetry((token) => listConversationsRequest(token));
      setConversations(list);
    } catch {
      // Ignore refresh failures in the chat surface.
    }
  }, [withAccessTokenRetry]);

  useEffect(() => {
    if (!canUse) {
      setIsLoadingConversations(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const list = await withAccessTokenRetry((token) => listConversationsRequest(token));
        if (!cancelled) {
          setConversations(list);
        }

        const rememberedConversationId = readActiveConversationId(activeConversationKey);
        if (!rememberedConversationId || cancelled) {
          return;
        }

        if (!list.some((conversation) => conversation.id === rememberedConversationId)) {
          clearActiveConversation();
          return;
        }

        try {
          await loadConversation(rememberedConversationId);
        } catch {
          if (!cancelled) {
            clearActiveConversation();
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoadingConversations(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeConversationKey,
    canUse,
    clearActiveConversation,
    loadConversation,
    withAccessTokenRetry,
  ]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) {
      return;
    }

    setInput("");
    setError(null);
    setIsStreaming(true);
    setStreamingText("");
    setActiveToolCalls([]);
    setConfirmResult(null);
    setPendingProposal(null);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, userMessage]);

    try {
      let activeConversationId = conversationId;
      if (!activeConversationId) {
        const created = await withAccessTokenRetry((accessToken) => createConversationRequest(accessToken));
        activeConversationId = created.id;
        setConversationId(created.id);
        rememberActiveConversation(created.id);
      }

      let fullText = "";
      let latestGeneratedProposal: DispatchProposal | null = null;

      const controller = new AbortController();
      abortRef.current = controller;

      const response = await withAccessTokenRetry((accessToken) =>
        openMessageStreamRequest(
          accessToken,
          activeConversationId,
          trimmed,
          Intl.DateTimeFormat().resolvedOptions().timeZone,
          controller.signal,
        ),
      );

      await consumeMessageStream(response, {
        onTextDelta: (text) => {
          fullText += text;
          setStreamingText((current) => current + text);
        },
        onToolUse: (tool, toolInput) => {
          setActiveToolCalls((current) => [
            ...current,
            { name: tool, input: toolInput, status: "running" },
          ]);
        },
        onToolResult: (tool, result) => {
          const maybeProposal = (result as { proposal?: DispatchProposal } | undefined)?.proposal;
          if (maybeProposal) {
            latestGeneratedProposal = maybeProposal;
            setPendingProposal(maybeProposal);
          }

          setActiveToolCalls((current) =>
            current.map((toolCall, index) =>
              index === current.findIndex((item) => item.name === tool && item.status === "running")
                ? { ...toolCall, result, status: "done" }
                : toolCall,
            ),
          );
        },
        onError: (message) => {
          setError(message);
        },
        onDone: () => {
          if (fullText) {
            setMessages((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                role: "assistant",
                content: fullText,
                proposal: latestGeneratedProposal ?? undefined,
                createdAt: new Date().toISOString(),
              },
            ]);
          }

          setStreamingText("");
          setActiveToolCalls([]);
          setIsStreaming(false);
          void refreshConversations();
        },
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to send message.",
      );
      setIsStreaming(false);
    }
  };

  const handleConfirmProposal = useCallback(async () => {
    if (!conversationId || !pendingProposal) {
      return;
    }

    setIsConfirming(true);
    setError(null);

    try {
      const result = await withAccessTokenRetry((accessToken) =>
        confirmProposalRequest(accessToken, conversationId, pendingProposal.id),
      );
      await loadConversation(conversationId, { preserveConfirmResult: true });
      setConfirmResult(result);
      await refreshConversations();
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "Failed to confirm dispatch plan.",
      );
    } finally {
      setIsConfirming(false);
    }
  }, [conversationId, loadConversation, pendingProposal, refreshConversations, withAccessTokenRetry]);

  const historyItems = useMemo(() => conversations, [conversations]);
  const isEmptyConversation = messages.length === 0 && !isStreaming;

  const resetComposerState = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setPendingProposal(null);
    setConfirmResult(null);
    setError(null);
    setStreamingText("");
    setActiveToolCalls([]);
    clearActiveConversation();
  }, [clearActiveConversation]);

  if (!canUse) {
    return (
      <div className={`${surfaceClassName} p-6`}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={`${surfaceClassName} relative flex h-[calc(100dvh-7rem)] min-h-[420px] min-w-0 overflow-hidden`}>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[image:var(--gradient-brand)] shadow-[0_12px_24px_-18px_var(--color-brand-glow)]">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[var(--color-text)]">AI Planner</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Optimize schedules, assign crew, and plan routes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                resetComposerState();
                setIsHistoryOpen(false);
              }}
              className={agentHeaderButtonClassName}
            >
              New
            </button>
            <button
              type="button"
              onClick={() => setIsHistoryOpen((current) => !current)}
              className={cn(
                agentHeaderButtonClassName,
                isHistoryOpen && "border-[var(--color-brand)] bg-[var(--color-brand-soft)]",
              )}
              aria-expanded={isHistoryOpen}
              aria-controls="planner-history-panel"
            >
              <History className="h-3.5 w-3.5" />
              {isHistoryOpen ? "Hide history" : "History"}
            </button>
          </div>
        </div>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-5 py-5",
            (isLoadingConversations || isEmptyConversation) && "flex items-center",
          )}
        >
          {isLoadingConversations ? (
            <LoadingPanel label="Loading planner conversation..." compact />
          ) : isEmptyConversation ? (
            <EmptyState onSuggestion={setInput} />
          ) : (
            <div className="flex w-full flex-col gap-4">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}

              {activeToolCalls.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {activeToolCalls.map((toolCall, index) => (
                    <ToolCallIndicator
                      key={`${toolCall.name}-${index}`}
                      toolCall={toolCall}
                    />
                  ))}
                </div>
              ) : null}

              {streamingText ? (
                <div className="flex gap-2.5 pr-4 sm:pr-12">
                  <AiAvatar />
                  <div className="max-w-[92%] rounded-[14px] rounded-bl bg-[var(--color-app-panel-muted)] px-4 py-3 text-[13px] leading-relaxed text-[var(--color-text)] sm:max-w-[84%] lg:max-w-[78%] xl:max-w-[74%]">
                    <div className="agent-markdown">
                      <Markdown>{streamingText}</Markdown>
                    </div>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
                  {error}
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {pendingProposal ? (
          <div className="border-t border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] px-4 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">
              <ProposalCard
                proposal={pendingProposal}
                onConfirm={handleConfirmProposal}
                confirming={isConfirming}
                result={confirmResult}
              />
            </div>
          </div>
        ) : null}

        {!pendingProposal && confirmResult ? (
          <div className="border-t border-[var(--color-app-border)] bg-[var(--color-success-soft)] px-4 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-6xl rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-5 py-4 text-sm text-[var(--color-success)] shadow-sm">
              {confirmResult.entityType === "customer" ? (
                <>
                  {confirmResult.updatedCustomerId
                    ? "Updated"
                    : confirmResult.usedExistingCustomer
                      ? "Reused"
                      : "Created"}{" "}
                  <strong>{confirmResult.updatedCustomerName ?? confirmResult.createdCustomerName ?? "customer"}</strong>.
                  {" "}
                  {confirmResult.updatedCustomerId ?? confirmResult.createdCustomerId ? (
                    <Link href={`/customers/${confirmResult.updatedCustomerId ?? confirmResult.createdCustomerId}`} className="font-semibold underline">
                      Open customer
                    </Link>
                  ) : null}
                </>
              ) : (
                <>
                  {confirmResult.updatedExistingJob ? "Updated" : "Created"}{" "}
                  <strong>{confirmResult.createdJobTitle}</strong>.
                  {" "}
                  {confirmResult.createdJobId ? (
                    <Link href={`/jobs/${confirmResult.createdJobId}`} className="font-semibold underline">
                      Open job
                    </Link>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : null}

        <div className="border-t border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-4 py-2.5">
          <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                isStreaming
                  ? "Planner is working..."
                  : "Ask the AI Planner..."
              }
              disabled={isStreaming}
              className={composerInputClassName}
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className={composerSendButtonClassName}
              aria-label="Send"
              title={isStreaming ? "Sending..." : "Send"}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {isHistoryOpen ? (
        <button
          type="button"
          aria-label="Close history panel"
          className="absolute inset-0 z-10 bg-black/10 backdrop-blur-[1px]"
          onClick={() => setIsHistoryOpen(false)}
        />
      ) : null}

      <aside
        id="planner-history-panel"
        className={cn(
          "absolute inset-y-0 right-0 z-20 flex w-full max-w-[280px] flex-col rounded-l-lg border-l border-[var(--color-app-border)] bg-[var(--color-app-panel)] shadow-[var(--shadow-floating)] transition-transform duration-200",
          isHistoryOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-app-border)] px-5 py-4">
          <span className="text-[13px] font-semibold text-[var(--color-text)]">
            Planner History
          </span>
          <button
            type="button"
            onClick={() => setIsHistoryOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition hover:bg-[var(--color-app-panel-muted)] hover:text-[var(--color-text)]"
            aria-label="Close history"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div className="border-b border-[var(--color-app-border)] px-4 pb-2 pt-3">
          <button
            type="button"
            onClick={() => {
              resetComposerState();
              setIsHistoryOpen(false);
            }}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] text-[12px] font-semibold text-[var(--color-text-secondary)] shadow-sm transition hover:border-[var(--color-app-border-strong)] hover:text-[var(--color-text)]"
          >
            <span className="text-base leading-none">+</span>
            New conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
          {isLoadingConversations ? (
            <LoadingPanel label="Loading planner history..." compact />
          ) : historyItems.length === 0 ? (
            <p className="px-2 pt-10 text-center text-xs leading-relaxed text-[var(--color-text-muted)]">
              No conversations yet.
              <br />
              Start a new chat to begin.
            </p>
          ) : (
            <div className="flex flex-col gap-0.5 pt-1">
              {historyItems.map((conversation) => {
                const active = conversation.id === conversationId;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => {
                      void loadConversation(conversation.id);
                      setIsHistoryOpen(false);
                    }}
                    className={cn(
                      "group rounded-lg px-3.5 py-2.5 text-left transition",
                      active
                        ? "bg-[var(--color-app-panel-muted)] shadow-sm"
                        : "hover:bg-[var(--color-app-panel-muted)]",
                    )}
                  >
                    <p
                      className={cn(
                        "truncate text-[12.5px] leading-snug",
                        active
                          ? "font-semibold text-[var(--color-text)]"
                          : "font-medium text-[var(--color-text-secondary)] group-hover:text-[var(--color-text)]",
                      )}
                    >
                      {conversation.preview || "New conversation"}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-[var(--color-text-muted)]">
                      {formatRelativeTime(conversation.updatedAt)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
