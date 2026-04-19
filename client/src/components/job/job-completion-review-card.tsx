"use client";

import { useState } from "react";
import { SummaryCard } from "@/components/ui/info-cards";
import {
  cn,
  primaryButtonClassName,
  secondaryButtonClassName,
  surfaceClassName,
  textAreaClassName,
} from "@/components/ui/styles";
import type { JobCompletionReviewItem, JobDetail } from "@/types/job";

type JobCompletionReviewCardProps = {
  job: JobDetail;
  review: JobCompletionReviewItem | null;
  canSubmit: boolean;
  canReview: boolean;
  isSubmitting?: boolean;
  error?: string | null;
  success?: string | null;
  onSubmit: (completionNote: string) => Promise<void>;
  onApprove: (review: JobCompletionReviewItem) => Promise<void>;
  onReturn: (review: JobCompletionReviewItem, reviewNote: string) => Promise<void>;
};

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}

function reviewStatusLabel(review: JobCompletionReviewItem | null) {
  if (!review) {
    return "No completion review submitted yet.";
  }

  switch (review.status) {
    case "APPROVED":
      return "Completion approved.";
    case "RETURNED":
      return "Returned for rework.";
    case "PENDING":
    default:
      return "Waiting for review.";
  }
}

export function JobCompletionReviewCard({
  job,
  review,
  canSubmit,
  canReview,
  isSubmitting = false,
  error = null,
  success = null,
  onSubmit,
  onApprove,
  onReturn,
}: JobCompletionReviewCardProps) {
  const [completionNote, setCompletionNote] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [showReturnForm, setShowReturnForm] = useState(false);

  const canShowSubmitForm = job.status === "IN_PROGRESS" && canSubmit;
  const canShowReviewControls = job.status === "PENDING_REVIEW" && review?.status === "PENDING" && canReview;
  const isReviewActive = job.status === "PENDING_REVIEW" || review?.status === "PENDING";

  return (
    <SummaryCard
      eyebrow="Completion Review"
      title="Completion review"
      description={
        isReviewActive
          ? "Completion is waiting for approval or rework."
          : "Latest completion decision and field closeout notes."
      }
    >
      <div className="space-y-4">
        {review ? (
          <div
            className={cn(
              surfaceClassName,
              "p-4",
              isReviewActive && "border-[var(--color-brand)] bg-[var(--color-brand-soft)]",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-sm font-bold text-[var(--color-text)]">
                {reviewStatusLabel(review)}
              </p>
              <span className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-2.5 py-1 text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
                {review.status.toLowerCase()}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              {review.completionNote}
            </p>
            <div className="mt-3 space-y-1 text-xs uppercase text-[var(--color-text-muted)]">
              <p>
                Submitted by {review.submittedBy.displayName} | {formatDateTime(review.submittedAt)}
              </p>
              {review.reviewedBy ? (
                <p>
                  Reviewed by {review.reviewedBy.displayName} | {formatDateTime(review.reviewedAt)}
                </p>
              ) : null}
            </div>
            {review.reviewNote ? (
              <p className="mt-3 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-warning-soft)] p-3 text-sm leading-6 text-[var(--color-warning)]">
                Return note: {review.reviewNote}
              </p>
            ) : null}
          </div>
        ) : (
          <div className={cn(surfaceClassName, "p-4 opacity-80")}>
            <p className="text-sm font-bold text-[var(--color-text)]">
              {reviewStatusLabel(null)}
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
              Completion notes will appear here once field work is ready for review.
            </p>
          </div>
        )}

        {canShowSubmitForm ? (
          <form
            className={cn(surfaceClassName, "space-y-3 p-4")}
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = completionNote.trim();
              if (!trimmed) {
                return;
              }
              void onSubmit(trimmed)
                .then(() => {
                  setCompletionNote("");
                })
                .catch(() => undefined);
            }}
          >
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--color-text)]">
                Completion note
              </span>
              <textarea
                value={completionNote}
                onChange={(event) => setCompletionNote(event.target.value)}
                className={textAreaClassName}
                placeholder="Summarize the completed work and mention any evidence already uploaded."
              />
            </label>
            <button
              type="submit"
              disabled={isSubmitting || !completionNote.trim()}
              className={primaryButtonClassName}
            >
              {isSubmitting ? "Submitting..." : "Submit for review"}
            </button>
          </form>
        ) : null}

        {canShowReviewControls && review ? (
          <div className={cn(surfaceClassName, "space-y-3 p-4")}>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void onApprove(review).catch(() => undefined)}
                className={primaryButtonClassName}
              >
                {isSubmitting ? "Working..." : "Approve completion"}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowReturnForm((current) => !current)}
                className={secondaryButtonClassName}
              >
                Return for rework
              </button>
            </div>

            {showReturnForm ? (
              <div className="space-y-3 rounded-lg border border-dashed border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-4">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">
                    Return note
                  </span>
                  <textarea
                    value={returnNote}
                    onChange={(event) => setReturnNote(event.target.value)}
                    className={textAreaClassName}
                    placeholder="Explain what needs to be fixed or added before approval."
                  />
                </label>
                <button
                  type="button"
                  disabled={isSubmitting || !returnNote.trim()}
                  onClick={() => {
                    const trimmed = returnNote.trim();
                    if (!trimmed) {
                      return;
                    }
                    void onReturn(review, trimmed)
                      .then(() => {
                        setReturnNote("");
                        setShowReturnForm(false);
                      })
                      .catch(() => undefined);
                  }}
                  className={secondaryButtonClassName}
                >
                  Confirm return
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        {success ? <p className="text-sm text-[var(--color-success)]">{success}</p> : null}
      </div>
    </SummaryCard>
  );
}
