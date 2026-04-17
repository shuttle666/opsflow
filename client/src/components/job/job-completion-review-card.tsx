"use client";

import { useState } from "react";
import { SummaryCard } from "@/components/ui/info-cards";
import {
  primaryButtonClassName,
  secondaryButtonClassName,
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
  const shouldRender =
    canShowSubmitForm ||
    canShowReviewControls ||
    job.status === "PENDING_REVIEW" ||
    job.status === "COMPLETED" ||
    Boolean(review);

  if (!shouldRender) {
    return null;
  }

  return (
    <SummaryCard
      eyebrow="Completion Review"
      title="Completion review"
      description="Staff submit completion details for review. Approved reviews close the job; returned reviews send it back for rework."
    >
      <div className="space-y-4">
        {review ? (
          <div className="rounded-[24px] border border-white/75 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">{reviewStatusLabel(review)}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{review.completionNote}</p>
            <div className="mt-3 space-y-1 text-xs uppercase tracking-[0.18em] text-slate-500">
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
              <p className="mt-3 text-sm leading-6 text-amber-700">
                Return note: {review.reviewNote}
              </p>
            ) : null}
          </div>
        ) : null}

        {canShowSubmitForm ? (
          <form
            className="space-y-3 rounded-[24px] border border-white/75 bg-white p-4 shadow-sm"
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
              <span className="text-sm font-medium text-slate-800">Completion note</span>
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
          <div className="space-y-3 rounded-[24px] border border-white/75 bg-white p-4 shadow-sm">
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
              <div className="space-y-3 rounded-[20px] border border-dashed border-amber-200 bg-amber-50/50 p-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-800">Return note</span>
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

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
      </div>
    </SummaryCard>
  );
}
