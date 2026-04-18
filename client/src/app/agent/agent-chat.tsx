"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import { History, Send, Sparkles } from "@/components/ui/icons";
import { LoadingPanel } from "@/components/ui/loading-panel";
import {
  cn,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  subtleButtonClassName,
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
  list_jobs: "Searching jobs",
  get_job_detail: "Loading job detail",
  list_customers: "Searching customers",
  get_customer_detail: "Loading customer detail",
  list_memberships: "Searching staff",
  list_activity_feed: "Checking activity",
  check_schedule_conflicts: "Checking schedule conflicts",
  save_dispatch_proposal: "Saving dispatch plan",
};

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

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end pl-12">
        <div className="max-w-[88%] rounded-[22px] rounded-br-lg bg-[linear-gradient(135deg,#0891b2_0%,#0ea5e9_52%,#38bdf8_100%)] px-5 py-3 text-[13.5px] leading-relaxed text-white shadow-[0_8px_24px_-12px_rgba(8,145,178,0.5)] sm:max-w-[80%] lg:max-w-[75%]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start pr-12">
      <div className="max-w-[88%] rounded-[22px] rounded-bl-lg border border-white/60 bg-white/70 px-5 py-3 text-[13.5px] leading-relaxed text-slate-700 shadow-[0_8px_20px_-14px_rgba(14,165,233,0.15)] backdrop-blur-sm sm:max-w-[80%] lg:max-w-[75%]">
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
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium",
        done
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-cyan-200 bg-cyan-50 text-cyan-700",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          done ? "bg-emerald-500" : "animate-pulse bg-cyan-500",
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
  const isCustomerOnly = proposal.intent === "create_customer";

  return (
    <div className="overflow-hidden rounded-[28px] border border-cyan-200/70 bg-white/82 shadow-[0_18px_40px_-24px_rgba(14,165,233,0.28)] backdrop-blur-sm">
      <div className="border-b border-cyan-100/80 bg-[linear-gradient(180deg,rgba(236,254,255,0.88)_0%,rgba(255,255,255,0.82)_100%)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-600">
              Dispatch Proposal
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">
              {isCustomerOnly
                ? `Create customer: ${proposal.customer.name ?? "New customer"}`
                : proposal.jobDraft.title}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
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
        <div className="rounded-[22px] border border-white/70 bg-slate-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Customer
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {proposal.customer.status === "matched"
              ? proposal.customer.matches?.[0]?.name ?? proposal.customer.query ?? "Matched customer"
              : proposal.customer.name ?? proposal.customer.query ?? "Customer to be resolved"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Status: {proposal.customer.status}
          </p>
          {proposal.customer.phone ? (
            <p className="mt-1 text-sm text-slate-500">Phone: {proposal.customer.phone}</p>
          ) : null}
          {proposal.customer.email ? (
            <p className="mt-1 text-sm text-slate-500">Email: {proposal.customer.email}</p>
          ) : null}
        </div>

        <div className="rounded-[22px] border border-white/70 bg-slate-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {isCustomerOnly ? "Intent" : "Schedule"}
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {isCustomerOnly
              ? "Create customer record"
              : formatScheduleRange(
                  proposal.scheduleDraft.scheduledStartAt ?? null,
                  proposal.scheduleDraft.scheduledEndAt ?? null,
                )}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {isCustomerOnly
              ? `Proposal type: ${proposal.intent}`
              : `Timezone: ${proposal.scheduleDraft.timezone}`}
          </p>
        </div>

        <div className="rounded-[22px] border border-white/70 bg-slate-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {isCustomerOnly ? "Customer details" : "Assignee"}
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {isCustomerOnly
              ? proposal.customer.address ?? "No address provided"
              : proposal.assigneeDraft?.displayName ?? "Unassigned"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {isCustomerOnly
              ? proposal.customer.notes ?? "No extra notes"
              : `Status: ${proposal.assigneeDraft?.status ?? "missing"}`}
          </p>
        </div>

        <div className="rounded-[22px] border border-white/70 bg-slate-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {isCustomerOnly ? "Job draft" : "Notes"}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {isCustomerOnly
              ? "No job will be created. Confirming this proposal creates only the customer record."
              : proposal.jobDraft.description?.trim() || "No extra description provided."}
          </p>
        </div>
      </div>

      {proposal.warnings.length > 0 ? (
        <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            Warnings
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {proposal.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-[22px] border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900">
          {result.entityType === "customer" ? (
            <>
              {result.usedExistingCustomer ? "Reused" : "Created"} <strong>{result.createdCustomerName ?? "customer"}</strong>.
              {" "}
              {result.createdCustomerId ? (
                <Link href={`/customers/${result.createdCustomerId}`} className="font-semibold underline">
                  Open customer
                </Link>
              ) : null}
            </>
          ) : (
            <>
              Created <strong>{result.createdJobTitle}</strong>.
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

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="relative">
        <div className="absolute -inset-3 rounded-full bg-cyan-400/20 blur-xl" />
        <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#0891b2_0%,#0ea5e9_52%,#38bdf8_100%)] shadow-[0_20px_40px_-16px_rgba(8,145,178,0.55)]">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
      </div>
      <div className="space-y-1.5">
        <h3 className="text-xl font-bold text-slate-800">Dispatch Planner</h3>
        <p className="max-w-md text-sm leading-relaxed text-slate-500">
          Describe the work in natural language, let AI draft the schedule and assignee, then confirm before anything is created.
        </p>
      </div>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        {[
          "Schedule an AC inspection for Mr. Wang next Tuesday afternoon, preferably with Technician Li",
          "Create a plumbing visit for Jordan tomorrow morning",
          "Check whether Mia already has overlapping work at 2pm",
        ].map((suggestion) => (
          <span
            key={suggestion}
            className="rounded-full border border-slate-200/70 bg-white/70 px-3.5 py-1.5 text-[12px] text-slate-500 shadow-sm backdrop-blur-sm"
          >
            {suggestion}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AgentChat() {
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, activeToolCalls, scrollToBottom]);

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
      } finally {
        if (!cancelled) {
          setIsLoadingConversations(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canUse, withAccessTokenRetry]);

  const loadConversation = useCallback(
    async (id: string, options?: { preserveConfirmResult?: boolean }) => {
      const detail = await withAccessTokenRetry((token) => getConversationRequest(token, id));
      setConversationId(id);
      setMessages(detail.messages);
      setPendingProposal(latestProposal(detail.messages));
      if (!options?.preserveConfirmResult) {
        setConfirmResult(null);
      }
      setStreamingText("");
      setActiveToolCalls([]);
    },
    [withAccessTokenRetry],
  );

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

  const resetComposerState = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setPendingProposal(null);
    setConfirmResult(null);
    setError(null);
    setStreamingText("");
    setActiveToolCalls([]);
  }, []);

  if (!canUse) {
    return (
      <div className={`${surfaceClassName} p-6`}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={`${surfaceClassName} relative flex h-[calc(100vh-180px)] min-w-0 overflow-hidden`}>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-white/30 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#0891b2_0%,#0ea5e9_100%)] shadow-[0_12px_24px_-14px_rgba(8,145,178,0.55)]">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-slate-700">Dispatch Planner</p>
              <p className="text-[11px] text-slate-400">
                Draft schedules and assignments first, then confirm before execution.
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
              className={cn(subtleButtonClassName, "h-8 gap-1.5 !rounded-xl px-3 text-[12px]")}
            >
              New
            </button>
            <button
              type="button"
              onClick={() => setIsHistoryOpen((current) => !current)}
              className={cn(subtleButtonClassName, "h-8 gap-1.5 !rounded-xl px-3 text-[12px]")}
              aria-expanded={isHistoryOpen}
              aria-controls="planner-history-panel"
            >
              <History className="h-3.5 w-3.5" />
              {isHistoryOpen ? "Hide history" : "History"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
          {messages.length === 0 && !isStreaming ? (
            <EmptyState />
          ) : (
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
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
                <div className="flex justify-start pr-12">
                  <div className="max-w-[88%] rounded-[22px] rounded-bl-lg border border-white/60 bg-white/70 px-5 py-3 text-[13.5px] leading-relaxed text-slate-700 shadow-[0_8px_20px_-14px_rgba(14,165,233,0.15)] backdrop-blur-sm sm:max-w-[80%] lg:max-w-[75%]">
                    <div className="agent-markdown">
                      <Markdown>{streamingText}</Markdown>
                    </div>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-[20px] border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {pendingProposal ? (
          <div className="border-t border-white/30 bg-[linear-gradient(180deg,rgba(248,250,252,0.42)_0%,rgba(255,255,255,0.72)_100%)] px-4 py-4 backdrop-blur-sm sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-5xl">
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
          <div className="border-t border-white/30 bg-[linear-gradient(180deg,rgba(236,253,245,0.48)_0%,rgba(255,255,255,0.76)_100%)] px-4 py-4 backdrop-blur-sm sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-5xl rounded-[24px] border border-emerald-200 bg-emerald-50/80 px-5 py-4 text-sm text-emerald-900 shadow-[0_14px_34px_-24px_rgba(16,185,129,0.35)]">
              {confirmResult.entityType === "customer" ? (
                <>
                  {confirmResult.usedExistingCustomer ? "Reused" : "Created"}{" "}
                  <strong>{confirmResult.createdCustomerName ?? "customer"}</strong>.
                  {" "}
                  {confirmResult.createdCustomerId ? (
                    <Link href={`/customers/${confirmResult.createdCustomerId}`} className="font-semibold underline">
                      Open customer
                    </Link>
                  ) : null}
                </>
              ) : (
                <>
                  Created <strong>{confirmResult.createdJobTitle}</strong>.
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

        <div className="border-t border-white/30 bg-white/20 px-4 py-4 backdrop-blur-sm sm:px-6 lg:px-8">
          <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-5xl items-center gap-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                isStreaming
                  ? "Planner is working..."
                  : "Describe the customer, work, preferred time, and assignee..."
              }
              disabled={isStreaming}
              className={inputClassName}
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className={cn(primaryButtonClassName, "h-11 gap-2 rounded-[18px] px-4")}
            >
              <Send className="h-4 w-4" />
              {isStreaming ? "Sending..." : "Send"}
            </button>
          </form>
        </div>
      </div>

      {isHistoryOpen ? (
        <button
          type="button"
          aria-label="Close history panel"
          className="absolute inset-0 z-10 bg-slate-900/12 backdrop-blur-[1px]"
          onClick={() => setIsHistoryOpen(false)}
        />
      ) : null}

      <aside
        id="planner-history-panel"
        className={cn(
          "absolute inset-y-0 right-0 z-20 flex w-full max-w-[280px] flex-col rounded-l-[28px] border-l border-slate-200/30 bg-slate-50/95 shadow-[-8px_0_40px_-16px_rgba(15,23,42,0.10)] backdrop-blur-xl transition-transform duration-200",
          isHistoryOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200/40 px-5 py-4">
          <span className="text-[13px] font-semibold text-slate-700">
            Planner History
          </span>
          <button
            type="button"
            onClick={() => setIsHistoryOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/50 hover:text-slate-600"
            aria-label="Close history"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div className="border-b border-slate-200/30 px-4 pb-2 pt-3">
          <button
            type="button"
            onClick={() => {
              resetComposerState();
              setIsHistoryOpen(false);
            }}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200/60 bg-white text-[12px] font-semibold text-slate-600 shadow-sm transition hover:border-slate-300/60 hover:bg-white hover:text-slate-800"
          >
            <span className="text-base leading-none">+</span>
            New conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
          {isLoadingConversations ? (
            <LoadingPanel label="Loading planner history..." compact />
          ) : historyItems.length === 0 ? (
            <p className="px-2 pt-10 text-center text-xs leading-relaxed text-slate-400">
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
                      "group rounded-xl px-3.5 py-2.5 text-left transition",
                      active
                        ? "bg-white shadow-sm"
                        : "hover:bg-white/70",
                    )}
                  >
                    <p
                      className={cn(
                        "truncate text-[12.5px] leading-snug",
                        active
                          ? "font-semibold text-slate-800"
                          : "font-medium text-slate-600 group-hover:text-slate-800",
                      )}
                    >
                      {conversation.preview || "New conversation"}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-slate-400">
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
