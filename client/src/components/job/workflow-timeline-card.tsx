import { useMemo, useState } from "react";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { SummaryCard } from "@/components/ui/info-cards";
import {
  primaryButtonClassName,
  secondaryButtonClassName,
  textAreaClassName,
} from "@/components/ui/styles";
import type { TimelineItemView, TransitionActionView } from "@/types/future-ui";

type WorkflowTimelineCardProps = {
  items: TimelineItemView[];
  actions: TransitionActionView[];
  currentStatusLabel: string;
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

export function WorkflowTimelineCard({
  items,
  actions,
  currentStatusLabel,
  isSubmitting = false,
  error = null,
  success = null,
  readOnlyMessage = null,
  onTransition,
}: WorkflowTimelineCardProps) {
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const selectedAction = useMemo(
    () => actions.find((action) => action.id === selectedActionId) ?? null,
    [actions, selectedActionId],
  );

  function handleActionClick(action: TransitionActionView) {
    if (action.requiresReason || action.requiresNote) {
      setSelectedActionId(action.id);
      return;
    }

    void onTransition?.(action);
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
      eyebrow="Workflow"
      title="Checklist & workflow"
      description="Track the live status history for this job and move it through the valid next steps."
    >
      <div className="space-y-4">
        <div className="rounded-[24px] border border-white/75 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Current status
          </p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{currentStatusLabel}</p>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold ${stateClasses(item.state)}`}
                >
                  {item.label.slice(0, 1)}
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
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {actions.length === 0 ? (
          <EmptyStatePanel
            compact
            title={readOnlyMessage ? "Read-only workflow" : "No further actions"}
            description={
              readOnlyMessage
                ? readOnlyMessage
                : "This job is already in a terminal state, so there are no further status transitions available."
            }
          />
        ) : (
          <div className="space-y-3 rounded-[24px] border border-white/75 bg-white p-4 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-slate-900">Next valid actions</p>
              <p className="text-sm text-slate-500">
                Only valid next states are shown here. Some transitions need a
                reason or completion note.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {actions.map((action, index) => (
                <button
                  key={action.id}
                  type="button"
                  disabled={isSubmitting || action.disabled}
                  onClick={() => handleActionClick(action)}
                  className={index === 0 ? primaryButtonClassName : secondaryButtonClassName}
                >
                  {action.label}
                </button>
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
                    disabled={isSubmitting || !reason.trim()}
                    onClick={() => void onTransition?.(selectedAction, reason.trim())}
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

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
          </div>
        )}
      </div>
    </SummaryCard>
  );
}
