"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import {
  ChevronDown,
  History,
  Send,
  Sparkles,
} from "@/components/ui/icons";
import { LoadingPanel } from "@/components/ui/loading-panel";
import {
  cn,
  primaryButtonClassName,
  surfaceClassName,
} from "@/components/ui/styles";
import { confirmProposalRequest, consumeMessageStream, createConversationRequest, getConversationRequest, listConversationsRequest, openMessageStreamRequest, updateProposalReviewRequest } from "@/features/agent";
import { formatScheduleRange } from "@/features/job";
import { useAuthStore } from "@/store/auth-store";
import type {
  ChatMessage,
  ConfirmProposalResult,
  ConversationSummary,
  DispatchProposal,
  UpdateProposalReviewInput,
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

const PLANNER_TAGS = ["Schedule", "Assign", "Update", "Review"] as const;

const agentHeaderButtonClassName =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-3 text-[12px] font-semibold text-[var(--color-brand)] shadow-sm transition hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)] disabled:cursor-not-allowed disabled:opacity-50";

const composerInputClassName =
  "h-9 min-w-0 flex-1 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-3.5 text-[13px] text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus:ring-[3px] focus:ring-[var(--color-brand-soft)] disabled:cursor-not-allowed disabled:opacity-60";

const composerSendButtonClassName =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand)] !text-white shadow-[0_4px_16px_-10px_var(--color-brand-glow)] transition hover:bg-[var(--color-brand-strong)] hover:!text-white disabled:cursor-not-allowed disabled:opacity-50";

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
    <div className="mt-0.5 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-[image:var(--gradient-brand)] text-[11px] font-extrabold !text-white shadow-[0_2px_8px_var(--color-brand-glow)]">
      AI
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex flex-row-reverse gap-2.5 pl-4 sm:pl-12">
        <div className="max-w-[92%] rounded-[14px] rounded-br px-4 py-3 text-[13px] leading-relaxed !text-white shadow-[0_2px_8px_var(--color-brand-glow)] sm:max-w-[84%] lg:max-w-[78%] xl:max-w-[74%]" style={{ background: "var(--color-brand)" }}>
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

function proposalTypeLabel(type: string) {
  return type.replaceAll("_", " ");
}

function shortId(id: string | undefined) {
  return id ? id.slice(0, 8) : "unresolved";
}

function formatValue(value: string | null | undefined) {
  return value?.trim() ? value : "blank";
}

function toDateTimeLocalValue(value: string | null | undefined, timeZone?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  if (timeZone) {
    try {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-US", {
          timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        })
          .formatToParts(date)
          .filter((part) => part.type !== "literal")
          .map((part) => [part.type, part.value]),
      );

      return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
    } catch {
      // Fall back to the browser timezone if the proposal timezone is invalid.
    }
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function proposalScheduleInputValue(
  proposal: DispatchProposal,
  field: "start" | "end",
) {
  const timezone = proposal.scheduleDraft.timezone;

  if (field === "start" && proposal.scheduleDraft.localDate && proposal.scheduleDraft.localStartTime) {
    return `${proposal.scheduleDraft.localDate}T${proposal.scheduleDraft.localStartTime}`;
  }

  if (field === "end" && proposal.scheduleDraft.localEndTime) {
    const localEndDate = proposal.scheduleDraft.localEndDate ?? proposal.scheduleDraft.localDate;

    if (localEndDate) {
      return `${localEndDate}T${proposal.scheduleDraft.localEndTime}`;
    }
  }

  return toDateTimeLocalValue(
    field === "start"
      ? proposal.scheduleDraft.scheduledStartAt
      : proposal.scheduleDraft.scheduledEndAt,
    timezone,
  );
}

function parseDateTimeLocalValue(value: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T([0-2]\d:[0-5]\d)$/u);

  if (!match) {
    return null;
  }

  return {
    localDate: match[1],
    localTime: match[2],
  };
}

function scheduleUpdateFromLocalInputs(
  startValue: string,
  endValue: string,
  timezone: string,
): NonNullable<UpdateProposalReviewInput["scheduleDraft"]> {
  const start = parseDateTimeLocalValue(startValue);
  const end = parseDateTimeLocalValue(endValue);

  if (!start && !end) {
    return {
      scheduledStartAt: null,
      scheduledEndAt: null,
      timezone,
    };
  }

  if (!start || !end) {
    return {
      localDate: start?.localDate ?? null,
      localStartTime: start?.localTime ?? null,
      localEndTime: end?.localTime ?? null,
      timezone,
    };
  }

  return {
    localDate: start.localDate,
    ...(end.localDate !== start.localDate ? { localEndDate: end.localDate } : {}),
    localStartTime: start.localTime,
    localEndTime: end.localTime,
    timezone,
  };
}

function ReviewStatusBadge({ status }: { status: string }) {
  const className =
    status === "READY"
      ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
      : status === "HAS_WARNINGS"
        ? "bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
        : "bg-[var(--color-danger-soft)] text-[var(--color-danger)]";

  return (
    <span className={cn("rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase", className)}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function ChangeRows({ rows }: { rows: Array<{ label: string; from: string | null | undefined; to: string | null | undefined }> }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        No field-level changes were included in this proposal.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-app-border)]">
      {rows.map((row) => (
        <div
          key={`${row.label}-${row.from}-${row.to}`}
          className="grid gap-2 border-b border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-3 py-2 text-sm last:border-b-0 sm:grid-cols-[140px_1fr_1fr]"
        >
          <div className="font-semibold text-[var(--color-text)]">{row.label}</div>
          <div className="text-[var(--color-text-secondary)]">
            <span className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">From</span>
            <p className="mt-0.5 break-words">{formatValue(row.from)}</p>
          </div>
          <div className="text-[var(--color-text-secondary)]">
            <span className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">To</span>
            <p className="mt-0.5 break-words font-medium text-[var(--color-text)]">{formatValue(row.to)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function buildChangeRows(proposal: DispatchProposal) {
  const type = proposal.type ?? (
    proposal.intent === "create_customer"
      ? "CREATE_CUSTOMER"
      : proposal.jobDraft.existingJobId
        ? "UPDATE_JOB"
        : "CREATE_JOB"
  );
  const jobSnapshot = proposal.review?.snapshots?.job;
  const rows: Array<{ label: string; from: string | null | undefined; to: string | null | undefined }> = [];

  if (type === "UPDATE_CUSTOMER") {
    return (proposal.changes ?? []).map((change) => ({
      label: change.field,
      from: change.from,
      to: change.to,
    }));
  }

  if (type === "CREATE_CUSTOMER") {
    return [
      { label: "Customer", from: null, to: proposal.customer.name ?? proposal.customer.query },
      { label: "Phone", from: null, to: proposal.customer.phone },
      { label: "Email", from: null, to: proposal.customer.email },
      { label: "Notes", from: null, to: proposal.customer.notes },
    ].filter((row) => row.to);
  }

  if (type === "CREATE_JOB") {
    rows.push({ label: "Job", from: null, to: proposal.jobDraft.title });
    rows.push({ label: "Service address", from: null, to: proposal.jobDraft.serviceAddress });
    rows.push({ label: "Description", from: null, to: proposal.jobDraft.description });
  } else {
    rows.push({ label: "Job", from: jobSnapshot?.title, to: proposal.jobDraft.title });
    if (proposal.jobDraft.serviceAddress) {
      rows.push({ label: "Service address", from: jobSnapshot?.serviceAddress, to: proposal.jobDraft.serviceAddress });
    }
    if (proposal.jobDraft.description !== undefined) {
      rows.push({ label: "Description", from: jobSnapshot?.description, to: proposal.jobDraft.description });
    }
  }

  if (proposal.assigneeDraft?.status === "matched") {
    rows.push({
      label: "Assignee",
      from: jobSnapshot?.assignedToName,
      to: proposal.assigneeDraft.displayName,
    });
  }

  if (proposal.scheduleDraft.scheduledStartAt || proposal.scheduleDraft.scheduledEndAt) {
    rows.push({
      label: "Schedule",
      from: formatScheduleRange(
        jobSnapshot?.scheduledStartAt ?? null,
        jobSnapshot?.scheduledEndAt ?? null,
        proposal.scheduleDraft.timezone,
      ),
      to: formatScheduleRange(
        proposal.scheduleDraft.scheduledStartAt ?? null,
        proposal.scheduleDraft.scheduledEndAt ?? null,
        proposal.scheduleDraft.timezone,
      ),
    });
  }

  if (proposal.statusDraft?.toStatus) {
    rows.push({
      label: "Status",
      from: jobSnapshot?.status,
      to: proposal.statusDraft.toStatus,
    });
  }

  return rows;
}

function ProposalCard({
  proposal,
  onConfirm,
  onUpdate,
  onHide,
  confirming,
  updating,
  result,
}: {
  proposal: DispatchProposal;
  onConfirm: () => void;
  onUpdate: (input: UpdateProposalReviewInput) => Promise<void>;
  onHide?: () => void;
  confirming: boolean;
  updating: boolean;
  result: ConfirmProposalResult | null;
}) {
  const proposalType = proposal.type ?? (
    proposal.intent === "create_customer"
      ? "CREATE_CUSTOMER"
      : proposal.jobDraft.existingJobId
        ? "UPDATE_JOB"
        : "CREATE_JOB"
  );
  const [scheduledStartAt, setScheduledStartAt] = useState(
    proposalScheduleInputValue(proposal, "start"),
  );
  const [scheduledEndAt, setScheduledEndAt] = useState(
    proposalScheduleInputValue(proposal, "end"),
  );
  const review = proposal.review;
  const blockers = review?.blockers ?? [];
  const warnings = review?.warnings ?? proposal.warnings;
  const hasBlockers = blockers.length > 0;
  const canEditSchedule = Boolean(
    proposalType === "SCHEDULE_JOB" ||
      proposal.scheduleDraft.scheduledStartAt ||
      proposal.scheduleDraft.scheduledEndAt,
  );
  const proposalTitle = proposalType === "UPDATE_CUSTOMER"
    ? `Update customer: ${proposal.customer.name ?? proposal.customer.query ?? "Customer"}`
    : proposalType === "CREATE_CUSTOMER"
      ? `Create customer: ${proposal.customer.name ?? "New customer"}`
      : proposal.jobDraft.title;
  const customerId = proposal.target?.customerId ?? proposal.customer.matchedCustomerId;
  const jobId = proposal.target?.jobId ?? proposal.jobDraft.existingJobId;
  const assignee = review?.snapshots?.assignee;
  const changeRows = buildChangeRows(proposal);

  useEffect(() => {
    setScheduledStartAt(proposalScheduleInputValue(proposal, "start"));
    setScheduledEndAt(proposalScheduleInputValue(proposal, "end"));
  }, [
    proposal,
  ]);

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] shadow-[var(--shadow-panel)]">
      <div className="border-b border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase text-[var(--color-brand)]">
              {proposalTypeLabel(proposalType)} approval
            </p>
            <h3 className="mt-1 text-lg font-bold text-[var(--color-text)]">
              {proposalTitle}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <ReviewStatusBadge status={review?.status ?? "READY"} />
              <span>Confidence {(proposal.confidence * 100).toFixed(0)}%</span>
              {jobId ? <span>Job #{shortId(jobId)}</span> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onHide ? (
              <button
                type="button"
                onClick={onHide}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] text-[var(--color-text-muted)] transition hover:border-[var(--color-app-border-strong)] hover:text-[var(--color-text)]"
                aria-label="Hide proposal panel"
                title="Hide proposal panel"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirming || hasBlockers}
              className={primaryButtonClassName}
            >
              {confirming ? "Confirming..." : "Confirm plan"}
            </button>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-4">
              <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                Target objects
              </p>
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <p className="font-semibold text-[var(--color-text)]">
                    Customer
                  </p>
                  <p className="mt-1 text-[var(--color-text-secondary)]">
                    {review?.snapshots?.customer?.name ?? proposal.customer.name ?? proposal.customer.query ?? "Unresolved customer"}
                  </p>
                  {customerId ? (
                    <Link href={`/customers/${customerId}`} className="mt-1 inline-block text-[12px] font-semibold text-[var(--color-brand)] underline">
                      Open customer #{shortId(customerId)}
                    </Link>
                  ) : null}
                </div>
                {proposalType !== "CREATE_CUSTOMER" && proposalType !== "UPDATE_CUSTOMER" ? (
                  <div>
                    <p className="font-semibold text-[var(--color-text)]">Job</p>
                    <p className="mt-1 text-[var(--color-text-secondary)]">
                      {review?.snapshots?.job?.title ?? proposal.jobDraft.title}
                    </p>
                    {jobId ? (
                      <Link href={`/jobs/${jobId}`} className="mt-1 inline-block text-[12px] font-semibold text-[var(--color-brand)] underline">
                        Open job #{shortId(jobId)}
                      </Link>
                    ) : (
                      <p className="mt-1 text-[12px] font-semibold text-[var(--color-danger)]">
                        Existing job unresolved
                      </p>
                    )}
                  </div>
                ) : null}
                {proposalType !== "CREATE_CUSTOMER" && proposalType !== "UPDATE_CUSTOMER" ? (
                  <div>
                    <p className="font-semibold text-[var(--color-text)]">Staff</p>
                    <p className="mt-1 text-[var(--color-text-secondary)]">
                      {assignee?.displayName ?? proposal.assigneeDraft?.displayName ?? "Unassigned"}
                    </p>
                    {assignee ? (
                      <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                        Membership #{shortId(assignee.membershipId)} · User #{shortId(assignee.userId)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {blockers.length > 0 ? (
              <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-danger-soft)] p-4">
                <p className="text-xs font-semibold uppercase text-[var(--color-danger)]">
                  Resolve before confirming
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-text)]">
                  {blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {warnings.length > 0 ? (
              <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-warning-soft)] p-4">
                <p className="text-xs font-semibold uppercase text-[var(--color-warning)]">
                  Warnings
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-text)]">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-4">
              <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                What will change
              </p>
              <div className="mt-3">
                <ChangeRows rows={changeRows} />
              </div>
            </div>

            {(review?.candidates?.customers?.length || review?.candidates?.jobs?.length || review?.candidates?.staff?.length) ? (
              <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-4">
                <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                  Candidate selection
                </p>
                {review?.candidates?.customers?.length ? (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-[var(--color-text)]">Customer</p>
                    <div className="mt-2 grid gap-2">
                      {review.candidates.customers.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          disabled={updating || candidate.id === customerId}
                          onClick={() => void onUpdate({ customerId: candidate.id })}
                          className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-3 py-2 text-left text-sm text-[var(--color-text)] transition hover:border-[var(--color-brand)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="font-semibold">{candidate.name}</span>
                          <span className="ml-2 text-[12px] text-[var(--color-text-muted)]">#{shortId(candidate.id)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {review?.candidates?.jobs?.length ? (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-[var(--color-text)]">Existing job</p>
                    <div className="mt-2 grid gap-2">
                      {review.candidates.jobs.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          disabled={updating || candidate.id === jobId}
                          onClick={() => void onUpdate({ jobId: candidate.id })}
                          className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-3 py-2 text-left text-sm text-[var(--color-text)] transition hover:border-[var(--color-brand)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="font-semibold">{candidate.title}</span>
                          <span className="ml-2 text-[12px] text-[var(--color-text-muted)]">#{shortId(candidate.id)}</span>
                          <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">
                            {candidate.serviceAddress ?? "No address"} · {candidate.status}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {review?.candidates?.staff?.length ? (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-[var(--color-text)]">Staff</p>
                    <div className="mt-2 grid gap-2">
                      {review.candidates.staff.map((candidate) => (
                        <button
                          key={candidate.membershipId}
                          type="button"
                          disabled={updating || candidate.membershipId === proposal.assigneeDraft?.membershipId}
                          onClick={() => void onUpdate({ membershipId: candidate.membershipId })}
                          className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-3 py-2 text-left text-sm text-[var(--color-text)] transition hover:border-[var(--color-brand)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="font-semibold">{candidate.displayName}</span>
                          <span className="ml-2 text-[12px] text-[var(--color-text-muted)]">#{shortId(candidate.membershipId)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {canEditSchedule ? (
              <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-4">
                <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                  Time window
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="text-[12px] font-semibold text-[var(--color-text-secondary)]">
                    Start
                    <input
                      type="datetime-local"
                      value={scheduledStartAt}
                      onChange={(event) => setScheduledStartAt(event.target.value)}
                      className="mt-1 h-9 w-full rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
                    />
                  </label>
                  <label className="text-[12px] font-semibold text-[var(--color-text-secondary)]">
                    End
                    <input
                      type="datetime-local"
                      value={scheduledEndAt}
                      onChange={(event) => setScheduledEndAt(event.target.value)}
                      className="mt-1 h-9 w-full rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] text-[var(--color-text-muted)]">
                    Timezone: {proposal.scheduleDraft.timezone}
                  </p>
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => void onUpdate({
                      scheduleDraft: scheduleUpdateFromLocalInputs(
                        scheduledStartAt,
                        scheduledEndAt,
                        proposal.scheduleDraft.timezone,
                      ),
                    })}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-3 text-[12px] font-semibold text-[var(--color-brand)] transition hover:border-[var(--color-brand)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updating ? "Updating..." : "Update time"}
                  </button>
                </div>
                {review?.scheduleConflicts?.hasConflict ? (
                  <div className="mt-3 rounded-lg bg-[var(--color-warning-soft)] p-3">
                    <p className="text-sm font-semibold text-[var(--color-warning)]">
                      Schedule conflict detected
                    </p>
                    <div className="mt-2 space-y-2">
                      {review.scheduleConflicts.conflicts.map((conflict) => (
                        <div key={conflict.id} className="text-[12px] text-[var(--color-text)]">
                          <p className="font-semibold">{conflict.title}</p>
                          <p className="text-[var(--color-text-secondary)]">
                            {formatScheduleRange(
                              conflict.scheduledStartAt,
                              conflict.scheduledEndAt,
                              proposal.scheduleDraft.timezone,
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[12px] text-[var(--color-text-secondary)]">
                      Managers can still confirm this plan if the overlap is intentional.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

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
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[image:var(--gradient-brand)] !text-white shadow-[0_18px_36px_-24px_var(--color-brand-glow)]">
        <Sparkles className="h-5 w-5" />
      </div>

      <h2 className="mt-5 max-w-xl text-2xl font-bold tracking-normal text-[var(--color-text)] sm:text-3xl">
        What should OpsFlow plan next?
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--color-text-secondary)]">
        Ask in plain language, or start with one of these workspace tasks.
      </p>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {PLANNER_TAGS.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] px-3 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]"
          >
            {tag}
          </span>
        ))}
      </div>

      {onSuggestion ? (
        <div className="mt-7 grid w-full gap-2 sm:grid-cols-2">
          {PLANNER_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSuggestion(suggestion)}
              className="group flex min-h-[52px] items-center justify-between gap-3 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] px-4 py-3 text-left text-[13px] font-semibold text-[var(--color-text)] transition hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]"
            >
              <span className="line-clamp-2">{suggestion}</span>
              <Send className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] transition group-hover:text-[var(--color-brand)]" />
            </button>
          ))}
        </div>
      ) : null}
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
  const [isProposalPanelOpen, setIsProposalPanelOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isUpdatingProposal, setIsUpdatingProposal] = useState(false);
  const [confirmResult, setConfirmResult] = useState<ConfirmProposalResult | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastOpenedProposalIdRef = useRef<string | null>(null);
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

  useEffect(() => {
    const proposalId = pendingProposal?.id ?? null;

    if (!proposalId) {
      lastOpenedProposalIdRef.current = null;
      setIsProposalPanelOpen(false);
      return;
    }

    if (lastOpenedProposalIdRef.current !== proposalId) {
      lastOpenedProposalIdRef.current = proposalId;
      setIsProposalPanelOpen(true);
    }
  }, [pendingProposal?.id]);

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

  const handleProposalReviewUpdate = useCallback(async (input: UpdateProposalReviewInput) => {
    if (!conversationId || !pendingProposal) {
      return;
    }

    setIsUpdatingProposal(true);
    setError(null);
    setConfirmResult(null);

    try {
      const updated = await withAccessTokenRetry((accessToken) =>
        updateProposalReviewRequest(accessToken, conversationId, pendingProposal.id, input),
      );
      setPendingProposal(updated);
      setMessages((current) =>
        current.map((message) =>
          message.proposal?.id === updated.id ? { ...message, proposal: updated } : message,
        ),
      );
      await refreshConversations();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update dispatch plan.",
      );
    } finally {
      setIsUpdatingProposal(false);
    }
  }, [conversationId, pendingProposal, refreshConversations, withAccessTokenRetry]);

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

        {pendingProposal && !isHistoryOpen ? (
          isProposalPanelOpen ? (
            <div className="pointer-events-none absolute inset-x-3 bottom-[76px] z-20 flex justify-center sm:inset-x-5">
              <div className="proposal-glow-shell pointer-events-auto w-full max-w-5xl">
                <span className="proposal-glow-halo" aria-hidden="true" />
                <span className="proposal-glow-border" aria-hidden="true" />
                <div className="proposal-glow-content max-h-[min(74dvh,720px)] overflow-y-auto">
                  <ProposalCard
                    proposal={pendingProposal}
                    onConfirm={handleConfirmProposal}
                    onUpdate={handleProposalReviewUpdate}
                    onHide={() => setIsProposalPanelOpen(false)}
                    confirming={isConfirming}
                    updating={isUpdatingProposal}
                    result={confirmResult}
                  />
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsProposalPanelOpen(true)}
              className="absolute inset-x-3 bottom-[76px] z-20 mx-auto flex min-h-12 w-[calc(100%-1.5rem)] max-w-3xl items-center justify-between gap-3 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-4 py-2.5 text-left shadow-[var(--shadow-floating)] transition hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)] sm:inset-x-5 sm:w-[calc(100%-2.5rem)]"
              aria-label="Show proposal panel"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold uppercase tracking-normal text-[var(--color-brand)]">
                  Pending approval
                </span>
                <span className="mt-0.5 block truncate text-[13px] font-semibold text-[var(--color-text)]">
                  {proposalTypeLabel(pendingProposal.type ?? pendingProposal.intent)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <ReviewStatusBadge status={pendingProposal.review?.status ?? "READY"} />
                <span className="text-[12px] font-semibold text-[var(--color-brand)]">
                  Open review
                </span>
              </span>
            </button>
          )
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
