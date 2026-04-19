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
  surfaceClassName,
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
      return "border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-success)]";
    case "current":
      return "border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]";
    default:
      return "border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] text-[var(--color-text-muted)]";
  }
}

function timelineMarkerClasses(item: TimelineItemView) {
  if (item.status === "CANCELLED") {
    return "border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]";
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
      description="Track current stage, recent movement, and fallback controls without leaving this record."
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-4">
            <p className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
              Current status
            </p>
            <p className="mt-2 text-lg font-bold text-[var(--color-text)]">{currentStatusLabel}</p>
          </div>
          <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-4">
            <p className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
              Assigned to
            </p>
            <p className="mt-2 text-lg font-bold text-[var(--color-text)]">
              {assigneeName ?? "Unassigned"}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-4">
            <p className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
              Your access
            </p>
            <p className="mt-2 text-sm font-bold text-[var(--color-text)]">
              {formatRoleLabel(currentRole)}
              {currentUserName ? ` - ${currentUserName}` : ""}
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
              {effectiveAccessMessage}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-brand-soft)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-sm font-bold text-[var(--color-text)]">{statusGuidance.title}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                {statusGuidance.nextStep}
              </p>
            </div>
            <span className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-3 py-1 text-[11px] font-semibold uppercase text-[var(--color-brand)]">
              Current handoff
            </span>
          </div>

          <details className="mt-3 group">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--color-brand)]">
              Status guidance
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] p-3">
                <p className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
                  Owner / Manager
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  {statusGuidance.ownerManager}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] p-3">
                <p className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
                  Assigned staff
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  {statusGuidance.staff}
                </p>
              </div>
              <p className="md:col-span-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                {statusGuidance.description}
              </p>
            </div>
          </details>
        </div>

        {hasManualStatusActions ? (
          <div className={`${surfaceClassName} space-y-3 p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-xl">
                <p className="text-sm font-bold text-[var(--color-text)]">Status controls</p>
                <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                  Manual transitions stay folded until they are needed for correction or unblock.
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
                        "rounded-lg border p-3",
                        selectedActionId === action.id
                          ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]"
                          : "border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)]",
                      )}
                    >
                      <div className="flex h-full flex-col gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-[var(--color-text)]">
                              {action.label}
                            </p>
                            <span className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-2.5 py-1 text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
                              {actionInputSummary(action)}
                            </span>
                          </div>
                          {action.description ? (
                            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
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
                  <div className="space-y-3 rounded-lg border border-dashed border-[var(--color-brand)] bg-[var(--color-app-panel-muted)] p-4">
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-[var(--color-text)]">
                        {inputLabel}
                      </span>
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

            {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
            {success ? <p className="text-sm text-[var(--color-success)]">{success}</p> : null}
          </div>
        ) : isTerminalStatus ? (
          <EmptyStatePanel
            compact
            title="Lifecycle is settled"
            description="This job is already completed or cancelled, so there are no further lifecycle stages to show."
          />
        ) : null}

        <div className={`${surfaceClassName} space-y-3 p-4`}>
          <div>
            <p className="text-sm font-bold text-[var(--color-text)]">Status history</p>
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
              A compact view of the path already taken and the next expected stage.
            </p>
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="flex shrink-0 flex-col items-center">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${timelineMarkerClasses(item)}`}
                  >
                    <StatusMarkerIcon status={item.status} />
                  </div>
                  {item.id !== items[items.length - 1]?.id ? (
                    <div className="mt-2 h-full w-px bg-[var(--color-app-border)]" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-[var(--color-text)]">{item.label}</p>
                    <p className="text-xs uppercase text-[var(--color-text-muted)]">
                      {item.timestamp ?? "Pending"}
                    </p>
                  </div>
                  {item.description ? (
                    <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
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
