import { useMemo, useState } from "react";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  CircleX,
  FileClock,
  ShieldCheck,
} from "@/components/ui/icons";
import { SummaryCard } from "@/components/ui/info-cards";
import {
  cn,
  primaryButtonClassName,
  secondaryButtonClassName,
  textAreaClassName,
} from "@/components/ui/styles";
import type { TimelineItemView, TransitionActionView } from "@/types/future-ui";
import type { JobStatus } from "@/types/job";

type WorkflowTimelineCardProps = {
  items: TimelineItemView[];
  actions: TransitionActionView[];
  currentStatus: JobStatus;
  currentStatusLabel: string;
  currentRole?: string;
  currentUserName?: string | null;
  assigneeName?: string | null;
  isAssignedToCurrentUser?: boolean;
  canEditJob?: boolean;
  canTransition?: boolean;
  canShowManualControls?: boolean;
  isSubmitting?: boolean;
  error?: string | null;
  success?: string | null;
  readOnlyMessage?: string | null;
  onTransition?: (action: TransitionActionView, reason?: string) => void | Promise<void>;
};

function stateClasses(state: TimelineItemView["state"]) {
  switch (state) {
    case "completed":
      return "border-emerald-100 bg-emerald-50 text-emerald-600";
    case "current":
      return "border-cyan-100 bg-cyan-50 text-cyan-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-500";
  }
}

function timelineMarkerClasses(item: TimelineItemView) {
  if (item.status === "CANCELLED") {
    return "border-rose-100 bg-rose-50 text-rose-600";
  }

  return stateClasses(item.state);
}

function StatusMarkerIcon({ status }: { status: JobStatus }) {
  const className = "h-[18px] w-[18px]";

  switch (status) {
    case "NEW":
      return <FileClock className={className} />;
    case "SCHEDULED":
      return <Calendar className={className} />;
    case "IN_PROGRESS":
      return <Briefcase className={className} />;
    case "PENDING_REVIEW":
      return <ShieldCheck className={className} />;
    case "COMPLETED":
      return <CheckCircle2 className={className} />;
    case "CANCELLED":
      return <CircleX className={className} />;
  }
}

function formatRoleLabel(role?: string) {
  switch (role) {
    case "OWNER":
      return "Owner";
    case "MANAGER":
      return "Manager";
    case "STAFF":
      return "Staff";
    default:
      return "No role selected";
  }
}

function getStatusGuidance(status: JobStatus, assigneeName?: string | null) {
  const assignedStaff = assigneeName ?? "Assigned staff";

  switch (status) {
    case "NEW":
      return {
        title: "Prepare for dispatch",
        description:
          "The job is in intake. Customer details, schedule, and assignment should be prepared before it becomes scheduled.",
        nextStep:
          "Normal progress should come from setting a visit window and assigning staff.",
        ownerManager: "Prepare the schedule and assignee. Use manual status edit only as a fallback.",
        staff: "Wait until the job is assigned and scheduled.",
      };
    case "SCHEDULED":
      return {
        title: "Ready for field work",
        description: `${assignedStaff} is lined up for the visit. The next signal should come from field work starting.`,
        nextStep:
          "Normal progress should come from the assigned staff beginning the visit.",
        ownerManager: "Monitor the visit and adjust schedule or assignment if needed.",
        staff: "Use the field workflow when the visit begins.",
      };
    case "IN_PROGRESS":
      return {
        title: "Work is underway",
        description: `${assignedStaff} is actively working this job. Evidence and completion details should explain the outcome.`,
        nextStep:
          "Normal progress should come from field completion and supporting evidence.",
        ownerManager: "Support the active visit and review field evidence.",
        staff: "Upload evidence and record the field outcome when the work is done.",
      };
    case "PENDING_REVIEW":
      return {
        title: "Completion submitted, waiting for review",
        description: `${assignedStaff} has submitted completion details. The job stays open until the review is approved.`,
        nextStep:
          "Owner or manager should review the completion note and supporting evidence.",
        ownerManager: "Approve completion or return the job for rework.",
        staff: "Wait for review, or add more evidence if requested.",
      };
    case "COMPLETED":
      return {
        title: "Work is closed",
        description:
          "The job has reached its final state. Keep the history and evidence here for review.",
        nextStep: "No further lifecycle step is expected.",
        ownerManager: "Review the completed record and evidence.",
        staff: "Review the completed record if you need the outcome later.",
      };
    case "CANCELLED":
      return {
        title: "Job is cancelled",
        description:
          "The job has reached its final state. The cancellation reason stays in the status history.",
        nextStep: "No further lifecycle step is expected.",
        ownerManager: "Review who cancelled the job and why.",
        staff: "Review the cancellation note if you need the context later.",
      };
  }
}

function getAccessMessage(input: {
  role?: string;
  canTransition: boolean;
  canEditJob: boolean;
  isAssignedToCurrentUser: boolean;
  hasActions: boolean;
}) {
  if (input.canTransition && (input.role === "OWNER" || input.role === "MANAGER")) {
    return input.canEditJob
      ? "You can edit job details and use manual status controls when a fallback is needed."
      : "You can use manual status controls when a fallback is needed.";
  }

  if (input.canTransition && input.role === "STAFF" && input.isAssignedToCurrentUser) {
    return "This job is assigned to you. Use the field workflow and evidence areas for progress.";
  }

  if (input.role === "STAFF") {
    return "Staff can advance only jobs assigned to them.";
  }

  if (!input.hasActions) {
    return "No status actions are available right now.";
  }

  return "You can review this job, but cannot advance its status.";
}

function actionInputSummary(action: TransitionActionView) {
  if (action.requiresReason) {
    return "Reason required";
  }

  if (action.requiresNote) {
    return "Note required";
  }

  return "No note required";
}

export function WorkflowTimelineCard({
  items,
  actions,
  currentStatus,
  currentStatusLabel,
  currentRole,
  currentUserName,
  assigneeName = null,
  isAssignedToCurrentUser = false,
  canEditJob = false,
  canTransition = false,
  canShowManualControls = false,
  isSubmitting = false,
  error = null,
  success = null,
  readOnlyMessage = null,
  onTransition,
}: WorkflowTimelineCardProps) {
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [isManualControlsOpen, setIsManualControlsOpen] = useState(false);

  const selectedAction = useMemo(
    () => actions.find((action) => action.id === selectedActionId) ?? null,
    [actions, selectedActionId],
  );

  const statusGuidance = getStatusGuidance(currentStatus, assigneeName);
  const hasAvailableActions = actions.length > 0;
  const hasManualStatusActions = canShowManualControls && hasAvailableActions;
  const isTerminalStatus = currentStatus === "COMPLETED" || currentStatus === "CANCELLED";
  const accessMessage = getAccessMessage({
    role: currentRole,
    canTransition,
    canEditJob,
    isAssignedToCurrentUser,
    hasActions: hasAvailableActions,
  });
  const effectiveAccessMessage = readOnlyMessage ?? accessMessage;

  function handleActionClick(action: TransitionActionView) {
    if (action.requiresReason || action.requiresNote) {
      setSelectedActionId(action.id);
      return;
    }

    setSelectedActionId(null);
    setReason("");
    void onTransition?.(action);
  }

  async function handleSelectedActionConfirm() {
    if (!selectedAction || !reason.trim()) {
      return;
    }

    await onTransition?.(selectedAction, reason.trim());
    setSelectedActionId(null);
    setReason("");
  }

  const inputRequired = Boolean(selectedAction?.requiresReason || selectedAction?.requiresNote);
  const inputLabel = selectedAction?.requiresReason
    ? "Cancellation reason"
    : "Completion note";
  const inputPlaceholder = selectedAction?.requiresReason
    ? "Explain why this job is being cancelled"
    : "Summarize the outcome of the completed work";

  return (
    <SummaryCard
      eyebrow="Progress"
      title="Job lifecycle"
      description="Review where this job sits in the service flow. Assignment, scheduling, field completion, and evidence should be the normal signals for progress."
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[24px] border border-white/75 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Current status
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{currentStatusLabel}</p>
          </div>
          <div className="rounded-[24px] border border-white/75 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Assigned to
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-950">
              {assigneeName ?? "Unassigned"}
            </p>
          </div>
          <div className="rounded-[24px] border border-white/75 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Your access
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-950">
              {formatRoleLabel(currentRole)}
              {currentUserName ? ` - ${currentUserName}` : ""}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">{effectiveAccessMessage}</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-cyan-100 bg-cyan-50/55 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-cyan-950">{statusGuidance.title}</p>
              <p className="mt-1 text-sm leading-6 text-cyan-900/75">
                {statusGuidance.description}
              </p>
              <p className="mt-3 text-sm leading-6 text-cyan-950">
                {statusGuidance.nextStep}
              </p>
            </div>
            <span className="rounded-full border border-cyan-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700">
              Current handoff
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-[20px] border border-white/75 bg-white/72 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Owner / Manager
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {statusGuidance.ownerManager}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/75 bg-white/72 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Assigned staff
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{statusGuidance.staff}</p>
            </div>
          </div>
        </div>

        {hasManualStatusActions ? (
          <div className="space-y-3 rounded-[24px] border border-white/75 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-xl">
                <p className="text-sm font-semibold text-slate-900">Manual status controls</p>
                <p className="text-sm leading-6 text-slate-500">
                  Hidden by default because lifecycle progress should come from assignment,
                  scheduling, field completion, and evidence events. Use this only to correct or
                  unblock the record.
                </p>
              </div>
              <button
                type="button"
                aria-expanded={isManualControlsOpen}
                onClick={() => {
                  setIsManualControlsOpen((current) => !current);
                  setSelectedActionId(null);
                  setReason("");
                }}
                className={secondaryButtonClassName}
              >
                {isManualControlsOpen ? "Hide status editor" : "Edit status"}
              </button>
            </div>

            {isManualControlsOpen ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  {actions.map((action, index) => (
                    <div
                      key={action.id}
                      className={cn(
                        "rounded-[20px] border p-3",
                        selectedActionId === action.id
                          ? "border-cyan-200 bg-cyan-50/70"
                          : "border-slate-100 bg-slate-50/70",
                      )}
                    >
                      <div className="flex h-full flex-col gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{action.label}</p>
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                              {actionInputSummary(action)}
                            </span>
                          </div>
                          {action.description ? (
                            <p className="text-sm leading-6 text-slate-500">
                              {action.description}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          disabled={isSubmitting || action.disabled || !canTransition}
                          onClick={() => handleActionClick(action)}
                          className={
                            index === 0 ? primaryButtonClassName : secondaryButtonClassName
                          }
                        >
                          {action.label}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedAction && inputRequired ? (
                  <div className="space-y-3 rounded-[20px] border border-dashed border-sky-200 bg-slate-50/70 p-4">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-800">{inputLabel}</span>
                      <textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        className={textAreaClassName}
                        placeholder={inputPlaceholder}
                      />
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isSubmitting || !reason.trim() || !canTransition}
                        onClick={() => void handleSelectedActionConfirm()}
                        className={primaryButtonClassName}
                      >
                        {isSubmitting ? "Saving..." : `Confirm ${selectedAction.label}`}
                      </button>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => {
                          setSelectedActionId(null);
                          setReason("");
                        }}
                        className={secondaryButtonClassName}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
          </div>
        ) : isTerminalStatus ? (
          <EmptyStatePanel
            compact
            title="Lifecycle is settled"
            description="This job is already completed or cancelled, so there are no further lifecycle stages to show."
          />
        ) : null}

        <div className="space-y-3 rounded-[24px] border border-white/75 bg-white p-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-900">Status history</p>
            <p className="text-sm leading-6 text-slate-500">
              Completed stages show who moved the job and when. Pending stages stay visible so
              the remaining path is clear.
            </p>
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="flex shrink-0 flex-col items-center">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${timelineMarkerClasses(item)}`}
                  >
                    <StatusMarkerIcon status={item.status} />
                  </div>
                  {item.id !== items[items.length - 1]?.id ? (
                    <div className="mt-2 h-full w-px bg-app-border" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      {item.timestamp ?? "Pending"}
                    </p>
                  </div>
                  {item.description ? (
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SummaryCard>
  );
}
