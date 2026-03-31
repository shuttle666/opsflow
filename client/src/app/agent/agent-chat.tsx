"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { History, Send, Sparkles } from "@/components/ui/icons";
import {
  cn,
  inputClassName,
  primaryButtonClassName,
  surfaceClassName,
  subtleButtonClassName,
} from "@/components/ui/styles";
import { useAuthStore } from "@/store/auth-store";
import {
  consumeMessageStream,
  createConversationRequest,
  listConversationsRequest,
  getConversationRequest,
  openMessageStreamRequest,
} from "@/features/agent";
import type { ConversationSummary } from "@/types/agent";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ name: string; input: unknown; result: unknown }>;
};

type ActiveToolCall = {
  name: string;
  input: unknown;
  result?: unknown;
  status: "running" | "done";
};

const TOOL_LABELS: Record<string, string> = {
  list_jobs: "Searching jobs",
  create_job: "Creating job",
  get_job_detail: "Getting job details",
  assign_job: "Assigning job",
  transition_job_status: "Updating job status",
  list_customers: "Searching customers",
  create_customer: "Creating customer",
  get_customer_detail: "Getting customer details",
  list_memberships: "Searching team members",
  list_activity_feed: "Checking activity",
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ToolCallIndicator({ toolCall }: { toolCall: ActiveToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const label = TOOL_LABELS[toolCall.name] ?? toolCall.name;
  const isDone = toolCall.status === "done";

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "inline-flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-[11px] font-medium transition",
          isDone
            ? "border-emerald-200/60 bg-emerald-50/60 text-emerald-700"
            : "border-cyan-200/60 bg-cyan-50/60 text-cyan-700",
        )}
      >
        <span
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            isDone ? "bg-emerald-500" : "animate-pulse bg-cyan-500",
          )}
        />
        {label}
        {isDone && (
          <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {expanded && (
        <div className="ml-1 mt-1.5 overflow-hidden rounded-xl border border-slate-100/80 bg-white/60 backdrop-blur-sm">
          <pre className="max-h-36 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-slate-600">
            {JSON.stringify(toolCall.result ?? toolCall.input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end pl-12">
        <div className="rounded-[22px] rounded-br-lg bg-[linear-gradient(135deg,#0891b2_0%,#0ea5e9_52%,#38bdf8_100%)] px-5 py-3 text-[13.5px] leading-relaxed text-white shadow-[0_8px_24px_-12px_rgba(8,145,178,0.5)]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start pr-12">
      <div className="rounded-[22px] rounded-bl-lg border border-white/60 bg-white/70 px-5 py-3 text-[13.5px] leading-relaxed text-slate-700 shadow-[0_8px_20px_-14px_rgba(14,165,233,0.15)] backdrop-blur-sm">
        <div className="agent-markdown">
          <Markdown>{message.content}</Markdown>
        </div>
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
        <h3 className="text-xl font-bold text-slate-800">AI Dispatch</h3>
        <p className="max-w-xs text-sm leading-relaxed text-slate-500">
          Manage jobs, customers, and team assignments using natural language.
        </p>
      </div>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        {[
          "Show all open jobs",
          "Create a maintenance job",
          "Who is available today?",
          "Recent activity summary",
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

function HistoryDrawer({
  open,
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onClose,
  isLoading,
}: {
  open: boolean;
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 z-10 bg-slate-900/10 backdrop-blur-[2px] transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "absolute right-0 top-0 z-20 flex h-full w-[280px] flex-col rounded-r-[32px] border-l border-slate-200/30 bg-slate-50/95 shadow-[-8px_0_40px_-16px_rgba(15,23,42,0.10)] backdrop-blur-xl transition-transform duration-250 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/40 px-5 py-4">
          <span className="text-[13px] font-semibold text-slate-700">
            Chat History
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/50 hover:text-slate-600"
            aria-label="Close history"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* New chat button */}
        <div className="px-4 pt-3 pb-1">
          <button
            type="button"
            onClick={() => { onNewChat(); onClose(); }}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200/60 bg-white text-[12px] font-semibold text-slate-600 shadow-sm transition hover:border-slate-300/60 hover:bg-white hover:text-slate-800"
          >
            <span className="text-base leading-none">+</span>
            New Chat
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
          {isLoading ? (
            <div className="flex flex-col gap-2 pt-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-200/40" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <p className="px-2 pt-10 text-center text-xs leading-relaxed text-slate-400">
              No conversations yet.
              <br />
              Start a new chat to begin.
            </p>
          ) : (
            <div className="flex flex-col gap-0.5 pt-1">
              {conversations.map((conv) => {
                const isActive = activeId === conv.id;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => { onSelect(conv.id); onClose(); }}
                    className={cn(
                      "group rounded-xl px-3.5 py-2.5 text-left transition",
                      isActive
                        ? "bg-white font-medium shadow-sm"
                        : "hover:bg-white/70",
                    )}
                  >
                    <p
                      className={cn(
                        "truncate text-[12.5px] leading-snug",
                        isActive
                          ? "font-semibold text-slate-800"
                          : "font-medium text-slate-600 group-hover:text-slate-800",
                      )}
                    >
                      {conv.preview || "New conversation"}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-slate-400">
                      {formatRelativeTime(conv.updatedAt)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
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

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function AgentChat() {
  const withAccessTokenRetry = useAuthStore((s) => s.withAccessTokenRetry);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [activeToolCalls, setActiveToolCalls] = useState<ActiveToolCall[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<{ abort: () => void } | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, activeToolCalls, scrollToBottom]);

  // Load conversation list on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await withAccessTokenRetry((token) =>
          listConversationsRequest(token),
        );
        if (!cancelled) setConversations(list);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setIsLoadingConversations(false);
      }
    })();
    return () => { cancelled = true; };
  }, [withAccessTokenRetry]);

  const refreshConversations = useCallback(async () => {
    try {
      const list = await withAccessTokenRetry((token) =>
        listConversationsRequest(token),
      );
      setConversations(list);
    } catch {
      // silently fail
    }
  }, [withAccessTokenRetry]);

  const handleSelectConversation = useCallback(
    async (id: string) => {
      if (id === conversationId || isStreaming) return;

      try {
        const detail = await withAccessTokenRetry((token) =>
          getConversationRequest(token, id),
        );
        setConversationId(id);
        setMessages(
          detail.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            toolCalls: m.toolCalls,
          })),
        );
        setError(null);
        setStreamingText("");
        setActiveToolCalls([]);
        inputRef.current?.focus();
      } catch {
        setError("Failed to load conversation.");
      }
    },
    [conversationId, isStreaming, withAccessTokenRetry],
  );

  const handleNewChat = useCallback(() => {
    if (isStreaming) return;
    setConversationId(null);
    setMessages([]);
    setError(null);
    setStreamingText("");
    setActiveToolCalls([]);
    inputRef.current?.focus();
  }, [isStreaming]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    setError(null);
    setInput("");
    setIsStreaming(true);
    setStreamingText("");
    setActiveToolCalls([]);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      let convId = conversationId;
      if (!convId) {
        const conv = await withAccessTokenRetry((accessToken) =>
          createConversationRequest(accessToken),
        );
        convId = conv.id;
        setConversationId(convId);
      }

      let fullText = "";
      const allToolCalls: ChatMessage["toolCalls"] = [];
      const controller = new AbortController();
      abortRef.current = { abort: () => controller.abort() };

      const response = await withAccessTokenRetry((accessToken) =>
        openMessageStreamRequest(
          accessToken,
          convId,
          trimmed,
          controller.signal,
        ),
      );

      await consumeMessageStream(response, {
        onTextDelta: (text) => {
          fullText += text;
          setStreamingText((prev) => prev + text);
        },
        onToolUse: (tool, toolInput) => {
          setActiveToolCalls((prev) => [
            ...prev,
            { name: tool, input: toolInput, status: "running" },
          ]);
        },
        onToolResult: (tool, result) => {
          allToolCalls.push({ name: tool, input: {}, result });
          setActiveToolCalls((prev) =>
            prev.map((tc) =>
              tc.name === tool && tc.status === "running"
                ? { ...tc, result, status: "done" as const }
                : tc,
            ),
          );
        },
        onError: (message) => {
          setError(message);
        },
        onDone: () => {
          if (fullText) {
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "assistant",
                content: fullText,
                toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
              },
            ]);
          }
          abortRef.current = null;
          setStreamingText("");
          setActiveToolCalls([]);
          setIsStreaming(false);
          inputRef.current?.focus();
          void refreshConversations();
        },
      });
    } catch (err) {
      abortRef.current = null;
      setError((err as Error).message ?? "Failed to send message.");
      setIsStreaming(false);
    }
  };

  return (
    <div className={cn(surfaceClassName, "relative flex h-[calc(100vh-180px)] flex-col overflow-hidden")}>
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-white/30 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#0891b2,#0ea5e9)] shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-[13px] font-semibold text-slate-700">
            {conversationId ? "Conversation" : "New Chat"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleNewChat}
            disabled={isStreaming || (!conversationId && messages.length === 0)}
            className={cn(
              subtleButtonClassName,
              "h-8 gap-1.5 !rounded-xl px-3 text-[12px]",
            )}
          >
            <span className="text-sm leading-none">+</span>
            New Chat
          </button>
          <button
            type="button"
            onClick={() => { setHistoryOpen(true); void refreshConversations(); }}
            className={cn(
              subtleButtonClassName,
              "h-8 gap-1.5 !rounded-xl px-3 text-[12px]",
            )}
          >
            <History className="h-3.5 w-3.5" />
            History
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {messages.length === 0 && !isStreaming ? (
          <EmptyState />
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Active tool calls */}
            {activeToolCalls.length > 0 && (
              <div className="flex justify-start pr-12">
                <div className="space-y-0.5">
                  {activeToolCalls.map((tc, i) => (
                    <ToolCallIndicator key={`${tc.name}-${i}`} toolCall={tc} />
                  ))}
                </div>
              </div>
            )}

            {/* Streaming text */}
            {streamingText && (
              <div className="flex justify-start pr-12">
                <div className="rounded-[22px] rounded-bl-lg border border-white/60 bg-white/70 px-5 py-3 text-[13.5px] leading-relaxed text-slate-700 shadow-[0_8px_20px_-14px_rgba(14,165,233,0.15)] backdrop-blur-sm">
                  <div className="agent-markdown">
                    <Markdown>{streamingText}</Markdown>
                  </div>
                  <span className="ml-0.5 inline-block h-[18px] w-[2px] translate-y-[3px] animate-pulse rounded-full bg-cyan-500" />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex justify-start pr-12">
                <div className="rounded-2xl border border-rose-200/60 bg-rose-50/70 px-4 py-2.5 text-[13px] text-rose-600 backdrop-blur-sm">
                  {error}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-white/30 bg-white/20 px-6 py-4 backdrop-blur-sm">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-2xl items-center gap-3"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isStreaming ? "Waiting for response..." : "Type a message..."}
            disabled={isStreaming}
            className={cn(
              inputClassName,
              "pr-4 shadow-[0_8px_24px_-16px_rgba(14,165,233,0.12)]",
            )}
            autoFocus
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className={cn(
              primaryButtonClassName,
              "h-11 w-11 shrink-0 !rounded-[18px] !px-0",
            )}
            aria-label="Send message"
          >
            <Send className="h-[18px] w-[18px]" />
          </button>
        </form>
      </div>

      {/* History drawer (right side, overlay) */}
      <HistoryDrawer
        open={historyOpen}
        conversations={conversations}
        activeId={conversationId}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
        onClose={() => setHistoryOpen(false)}
        isLoading={isLoadingConversations}
      />
    </div>
  );
}
