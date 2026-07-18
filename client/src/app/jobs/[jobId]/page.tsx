"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AuthGuard } from "@/components/auth/auth-guard";
import { JobEvidencePanel } from "@/components/job/job-evidence-panel";
import { JobAssignmentCard } from "@/components/job/job-assignment-card";
import { JobCompletionReviewCard } from "@/components/job/job-completion-review-card";
import { WorkflowTimelineCard } from "@/components/job/workflow-timeline-card";
import { AppShell } from "@/components/ui/app-shell";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  cn,
  primaryButtonClassName,
  secondaryButtonClassName,
  surfaceClassName,
  strongSurfaceClassName,
} from "@/components/ui/styles";
import { downloadJobEvidenceRequest } from "@/features/job/job-api";
import {
  useApproveJobCompletionReviewMutation,
  useDeleteJobEvidenceMutation,
  useJobCompletionReviewQuery,
  useJobDetailQuery,
  useJobEvidenceQuery,
  useJobHistoryQuery,
  useReturnJobCompletionReviewMutation,
  useSubmitJobCompletionReviewMutation,
  useTransitionJobStatusMutation,
  useUploadJobEvidenceMutation,
} from "@/features/job/job-queries";
import { useAuthenticatedQueryScope } from "@/hooks/use-authenticated-query";
import { formatDateTime, formatScheduleRange } from "@/features/job";
import { getApiErrorView, type ApiErrorView } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/store/auth-store";
import type {
  JobDetail,
  JobCompletionReviewItem,
  JobEvidenceItem,
  JobHistoryItem,
  JobStatus,
} from "@/types/job";
import type { TimelineItemView, TransitionActionView } from "@/types/future-ui";

function canManageJobs(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

function canTransitionJobs(role: string | undefined, userId: string | undefined, job: JobDetail) {
  if (role === "OWNER" || role === "MANAGER") {
    return true;
  }

  return role === "STAFF" && job.assignedTo?.id === userId;
}

function formatStatusLabel(status: JobStatus) {
  switch (status) {
    case "IN_PROGRESS":
      return "In progress";
    case "PENDING_REVIEW":
      return "Pending review";
    default:
      return status.charAt(0) + status.slice(1).toLowerCase();
  }
}

function formatHistoryDescription(entry?: JobHistoryItem, job?: JobDetail) {
  if (!entry) {
    return job ? `Job created by ${job.createdBy.displayName}.` : undefined;
  }

  const actor = entry.changedBy?.displayName ?? "System";
  if (entry.reason) {
    return `${actor} changed this job from ${formatStatusLabel(entry.fromStatus)} to ${formatStatusLabel(entry.toStatus)}. Note: ${entry.reason}`;
  }

  return `${actor} changed this job from ${formatStatusLabel(entry.fromStatus)} to ${formatStatusLabel(entry.toStatus)}.`;
}

function getTimelineItems(job: JobDetail, history: JobHistoryItem[]): TimelineItemView[] {
  const normalStatuses = [
    { status: "NEW", label: "New" },
    { status: "SCHEDULED", label: "Scheduled" },
    { status: "IN_PROGRESS", label: "In progress" },
    { status: "PENDING_REVIEW", label: "Pending review" },
    { status: "COMPLETED", label: "Completed" },
  ] as const satisfies Array<{ status: Exclude<JobStatus, "CANCELLED">; label: string }>;
  const cancelledStatus = { status: "CANCELLED", label: "Cancelled" } as const satisfies {
    status: JobStatus;
    label: string;
  };

  const historyByStatus = new Map(history.map((item) => [item.toStatus, item]));
  const cancellationHistory = historyByStatus.get("CANCELLED");

  function buildTimelineItem(
    item: { status: JobStatus; label: string },
    state: TimelineItemView["state"],
    timestampOverride?: string | null,
  ): TimelineItemView {
    const historyEntry = historyByStatus.get(item.status);

    return {
      id: item.status,
      label: item.label,
      status: item.status,
      timestamp:
        item.status === "NEW"
          ? formatDateTime(job.createdAt)
          : formatDateTime(timestampOverride ?? historyEntry?.changedAt ?? null),
      description:
        item.status === "NEW"
          ? formatHistoryDescription(undefined, job)
          : formatHistoryDescription(historyEntry),
      state,
    };
  }

  if (job.status === "CANCELLED") {
    const completedNormalStatuses = new Set<JobStatus>(["NEW"]);

    history.forEach((entry) => {
      if (entry.fromStatus !== "CANCELLED") {
        completedNormalStatuses.add(entry.fromStatus);
      }

      if (entry.toStatus !== "CANCELLED") {
        completedNormalStatuses.add(entry.toStatus);
      }
    });

    return [
      ...normalStatuses
        .filter((item) => completedNormalStatuses.has(item.status))
        .map((item) => buildTimelineItem(item, "completed")),
      buildTimelineItem(
        cancelledStatus,
        "current",
        cancellationHistory?.changedAt ?? job.updatedAt,
      ),
    ];
  }

  return normalStatuses.map((item) =>
    buildTimelineItem(
      item,
      item.status === job.status
        ? "current"
        : item.status === "NEW" || historyByStatus.has(item.status)
          ? "completed"
          : "upcoming",
    ),
  );
}

function getTransitionAction(status: JobStatus): TransitionActionView {
  switch (status) {
    case "SCHEDULED":
      return {
        id: "schedule",
        label: "Mark scheduled",
        description: "Use after the scheduled visit time and staff assignment are ready.",
        toStatus: "SCHEDULED",
      };
    case "IN_PROGRESS":
      return {
        id: "start",
        label: "Start work",
        description: "Use when the assigned staff member has begun the visit.",
        toStatus: "IN_PROGRESS",
      };
    case "COMPLETED":
      return {
        id: "complete",
        label: "Complete job",
        description: "Use only after completion review is approved.",
        toStatus: "COMPLETED",
        requiresNote: true,
      };
    case "PENDING_REVIEW":
      return {
        id: "send-review",
        label: "Send to review",
        description: "Use after completion details are ready for review.",
        toStatus: "PENDING_REVIEW",
      };
    case "CANCELLED":
      return {
        id: "cancel",
        label: "Cancel job",
        description: "Use when this visit will no longer go ahead. A reason is required.",
        toStatus: "CANCELLED",
        requiresReason: true,
      };
    case "NEW":
      return {
        id: "new",
        label: "Reopen as new",
        description: "Move the job back to intake if it needs to be prepared again.",
        toStatus: "NEW",
      };
  }
}

function getTransitionActions(statuses: JobStatus[]): TransitionActionView[] {
  return statuses.map((status) => getTransitionAction(status));
}

function getVisibleTransitionActions(
  currentStatus: JobStatus,
  statuses: JobStatus[],
  role: string | undefined,
): TransitionActionView[] {
  const actions = getTransitionActions(statuses);

  if (role !== "STAFF") {
    return actions;
  }

  if (currentStatus !== "SCHEDULED") {
    return [];
  }

  return actions.filter((action) => action.toStatus === "IN_PROGRESS");
}

function initialsFor(name: string | undefined | null) {
  if (!name) {
    return "OF";
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function DetailCard({
  eyebrow,
  title,
  children,
  className,
  ariaLabel,
}: {
  eyebrow?: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(surfaceClassName, className?.includes("p-0") ? "p-0" : "p-4", className)}
    >
      {eyebrow || title ? (
        <div className="mb-3 space-y-1">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h2 className="text-base font-bold text-[var(--color-text)]">{title}</h2>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-app-border)] py-1.5 last:border-b-0">
      <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
      <span
        className={cn(
          "max-w-[62%] text-right text-sm font-semibold text-[var(--color-text)]",
          mono && "font-mono text-xs",
        )}
      >
        {value || "-"}
      </span>
    </div>
  );
}

function OverviewMetric({
  label,
  value,
  meta,
}: {
  label: string;
  value: React.ReactNode;
  meta?: string;
}) {
  return (
    <div className={`${surfaceClassName} p-3.5`}>
      <p className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
        {label}
      </p>
      <div className="mt-2 text-base font-bold text-[var(--color-text)]">{value}</div>
      {meta ? (
        <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">{meta}</p>
      ) : null}
    </div>
  );
}

function WorkflowActivityCard({ history }: { history: JobHistoryItem[] }) {
  const recentItems = history.slice(-4).reverse();

  return (
    <DetailCard
      eyebrow="Activity"
      title="Recent workflow activity"
      ariaLabel="Recent workflow activity"
    >
      {recentItems.length === 0 ? (
        <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
          No workflow changes have been recorded yet.
        </p>
      ) : (
        <div className="space-y-3">
          {recentItems.map((item) => (
            <div key={item.id} className="flex gap-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-brand)]" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  {formatStatusLabel(item.fromStatus)} to {formatStatusLabel(item.toStatus)}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-[var(--color-text-secondary)]">
                  {item.changedBy?.displayName ?? "System"} | {formatDateTime(item.changedAt)}
                </p>
                {item.reason ? (
                  <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                    {item.reason}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </DetailCard>
  );
}

export default function JobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = typeof params.jobId === "string" ? params.jobId : "";
  const user = useAuthStore((state) => state.user);
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const queryClient = useQueryClient();
  const queryScope = useAuthenticatedQueryScope();
  const jobQuery = useJobDetailQuery(jobId);
  const workflowQuery = useJobHistoryQuery(jobId);
  const evidenceQuery = useJobEvidenceQuery(jobId);
  const completionReviewQuery = useJobCompletionReviewQuery(jobId);
  const transitionMutation = useTransitionJobStatusMutation();
  const uploadEvidenceMutation = useUploadJobEvidenceMutation();
  const deleteEvidenceMutation = useDeleteJobEvidenceMutation();
  const submitCompletionReviewMutation = useSubmitJobCompletionReviewMutation();
  const approveCompletionReviewMutation = useApproveJobCompletionReviewMutation();
  const returnCompletionReviewMutation = useReturnJobCompletionReviewMutation();
  const [workflowError, setWorkflowError] = useState<string | ApiErrorView | null>(null);
  const [workflowSuccess, setWorkflowSuccess] = useState<string | null>(null);
  const [completionReviewError, setCompletionReviewError] = useState<string | ApiErrorView | null>(null);
  const [completionReviewSuccess, setCompletionReviewSuccess] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | ApiErrorView | null>(null);
  const job = jobQuery.data ?? null;
  const workflow = workflowQuery.data ?? null;
  const completionReview = completionReviewQuery.data ?? null;
  const evidence = evidenceQuery.data ?? [];
  const error = !jobId
    ? "Job id is missing."
    : jobQuery.error
      ? getApiErrorView(jobQuery.error, "Failed to load job.")
      : null;
  const workflowRequestError = workflowQuery.error
    ? getApiErrorView(workflowQuery.error, "Failed to load job workflow.")
    : null;
  const completionReviewRequestError = completionReviewQuery.error
    ? getApiErrorView(
        completionReviewQuery.error,
        "Failed to load completion review.",
      )
    : null;
  const evidenceRequestError = evidenceQuery.error
    ? getApiErrorView(evidenceQuery.error, "Failed to load job evidence.")
    : null;
  const isSubmittingCompletionReview =
    submitCompletionReviewMutation.isPending ||
    approveCompletionReviewMutation.isPending ||
    returnCompletionReviewMutation.isPending;

  const canEdit = canManageJobs(currentTenant?.role);
  const canManageEvidence = job
    ? canTransitionJobs(currentTenant?.role, user?.id, job)
    : false;
  const canTransition = job
    ? canTransitionJobs(currentTenant?.role, user?.id, job)
    : false;

  const transitionActions =
    job && canTransition && workflow
      ? getVisibleTransitionActions(
          job.status,
          workflow.allowedTransitions,
          currentTenant?.role,
        )
      : [];

  async function handleTransition(action: TransitionActionView, reason?: string) {
    if (!job) {
      return;
    }

    setWorkflowError(null);
    setWorkflowSuccess(null);
    transitionMutation.reset();

    try {
      await transitionMutation.mutateAsync({
        jobId: job.id,
        input: {
          toStatus: action.toStatus,
          ...(reason ? { reason } : {}),
        },
      });

      setWorkflowSuccess(`Job moved to ${formatStatusLabel(action.toStatus)}.`);
    } catch (transitionError) {
      setWorkflowError(getApiErrorView(transitionError, "Failed to update job workflow."));
    }
  }

  async function handleEvidenceUpload(input: {
    kind: JobEvidenceItem["kind"];
    note?: string;
    file: File;
  }) {
    if (!job) {
      return;
    }

    setEvidenceError(null);
    uploadEvidenceMutation.reset();

    try {
      await uploadEvidenceMutation.mutateAsync({ jobId: job.id, input });
    } catch (uploadError) {
      setEvidenceError(getApiErrorView(uploadError, "Failed to upload evidence."));
      throw uploadError;
    }
  }

  async function handleCompletionReviewSubmit(completionNote: string) {
    if (!job) {
      return;
    }

    setCompletionReviewError(null);
    setCompletionReviewSuccess(null);
    submitCompletionReviewMutation.reset();

    try {
      await submitCompletionReviewMutation.mutateAsync({
        jobId: job.id,
        input: { completionNote },
      });
      setCompletionReviewSuccess("Completion submitted for review.");
    } catch (submitError) {
      setCompletionReviewError(
        getApiErrorView(submitError, "Failed to submit completion for review."),
      );
      throw submitError;
    }
  }

  async function handleCompletionReviewApprove(review: JobCompletionReviewItem) {
    if (!job) {
      return;
    }

    setCompletionReviewError(null);
    setCompletionReviewSuccess(null);
    approveCompletionReviewMutation.reset();

    try {
      await approveCompletionReviewMutation.mutateAsync({
        jobId: job.id,
        reviewId: review.id,
      });
      setCompletionReviewSuccess("Completion approved.");
    } catch (approveError) {
      setCompletionReviewError(getApiErrorView(approveError, "Failed to approve completion."));
      throw approveError;
    }
  }

  async function handleCompletionReviewReturn(
    review: JobCompletionReviewItem,
    reviewNote: string,
  ) {
    if (!job) {
      return;
    }

    setCompletionReviewError(null);
    setCompletionReviewSuccess(null);
    returnCompletionReviewMutation.reset();

    try {
      await returnCompletionReviewMutation.mutateAsync({
        jobId: job.id,
        reviewId: review.id,
        input: { reviewNote },
      });
      setCompletionReviewSuccess("Completion returned for rework.");
    } catch (returnError) {
      setCompletionReviewError(
        getApiErrorView(returnError, "Failed to return completion for rework."),
      );
      throw returnError;
    }
  }

  async function handleEvidenceDelete(evidenceId: string) {
    if (!job) {
      return;
    }

    setEvidenceError(null);
    deleteEvidenceMutation.reset();

    try {
      await deleteEvidenceMutation.mutateAsync({ jobId: job.id, evidenceId });
    } catch (deleteError) {
      setEvidenceError(getApiErrorView(deleteError, "Failed to delete evidence."));
      throw deleteError;
    }
  }

  async function handleEvidenceDownload(item: JobEvidenceItem) {
    if (!job) {
      return;
    }

    const blob = await withAccessTokenRetry((accessToken) =>
      downloadJobEvidenceRequest(accessToken, job.id, item.id),
    );
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = item.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <AppShell title="Job detail">
      <AuthGuard>
        {jobQuery.isLoading ? <LoadingPanel label="Loading job..." /> : null}
        {error ? <InlineErrorBanner message={error} /> : null}

        {job ? (
          <div className="space-y-4">
            <section className={`${strongSurfaceClassName} p-4`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-soft)] text-sm font-bold text-[var(--color-brand)]">
                    {initialsFor(job.customer.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                      Job #{job.id}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      <h1 className="text-2xl font-extrabold text-[var(--color-text)]">
                        {job.title}
                      </h1>
                      <StatusBadge kind="job" value={job.status} />
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      {job.customer.name} | Created by {job.createdBy.displayName}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link href={`/customers/${job.customer.id}`} className={secondaryButtonClassName}>
                    Open customer detail
                  </Link>
                  {canEdit ? (
                    <Link href={`/jobs/${job.id}/edit`} className={primaryButtonClassName}>
                      Edit job
                    </Link>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <OverviewMetric
                label="Status"
                value={<StatusBadge kind="job" value={job.status} />}
                meta={formatStatusLabel(job.status)}
              />
              <OverviewMetric
                label="Scheduled"
                value={formatScheduleRange(job.scheduledStartAt, job.scheduledEndAt)}
                meta="Visit time"
              />
              <OverviewMetric
                label="Assigned"
                value={job.assignedTo?.displayName ?? "Unassigned"}
                meta={job.assignedTo?.email ?? "No staff member assigned"}
              />
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0 space-y-4">
                <DetailCard eyebrow="Description" title="Work summary">
                  <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
                    {job.description ?? "No job description has been captured yet."}
                  </p>
                </DetailCard>

                <DetailCard eyebrow="Context" title="Schedule and customer">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                      <p className="mb-2 text-sm font-semibold text-[var(--color-text)]">
                        Schedule
                      </p>
                      <InfoRow
                        label="Visit time"
                        value={formatScheduleRange(job.scheduledStartAt, job.scheduledEndAt)}
                        mono
                      />
                      <InfoRow label="Service address" value={job.serviceAddress} />
                      <InfoRow label="Created" value={formatDateTime(job.createdAt)} mono />
                      <InfoRow label="Updated" value={formatDateTime(job.updatedAt)} mono />
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-semibold text-[var(--color-text)]">
                        Customer
                      </p>
                      <div className="mb-2 flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-brand-soft)] text-xs font-bold text-[var(--color-brand)]">
                          {initialsFor(job.customer.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                            {job.customer.name}
                          </p>
                          <p className="truncate text-xs text-[var(--color-text-secondary)]">
                            {job.customer.email ?? "No email"}
                          </p>
                        </div>
                      </div>
                      <InfoRow label="Phone" value={job.customer.phone ?? "-"} />
                      <InfoRow label="Email" value={job.customer.email ?? "-"} />
                      <div className="mt-4">
                        <Link
                          href={`/customers/${job.customer.id}`}
                          className={secondaryButtonClassName}
                        >
                          Open customer detail
                        </Link>
                      </div>
                    </div>
                  </div>
                </DetailCard>

                <WorkflowTimelineCard
                  items={workflow ? getTimelineItems(job, workflow.history) : []}
                  actions={transitionActions}
                  currentStatus={job.status}
                  currentStatusLabel={formatStatusLabel(job.status)}
                  currentRole={currentTenant?.role}
                  currentUserName={user?.displayName}
                  assigneeName={job.assignedTo?.displayName ?? null}
                  isAssignedToCurrentUser={job.assignedTo?.id === user?.id}
                  canEditJob={canEdit}
                  canTransition={canTransition}
                  canShowManualControls={transitionActions.length > 0}
                  isSubmitting={transitionMutation.isPending}
                  error={workflowError ?? workflowRequestError}
                  success={workflowSuccess}
                  readOnlyMessage={
                    !canTransition && workflow?.allowedTransitions?.length
                      ? "Your current role can review this lifecycle, but manual status edits are reserved for owners and managers."
                      : null
                  }
                  onTransition={handleTransition}
                />

                <JobCompletionReviewCard
                  job={job}
                  review={completionReview}
                  canSubmit={canTransition}
                  canReview={canEdit}
                  isSubmitting={isSubmittingCompletionReview}
                  error={completionReviewError ?? completionReviewRequestError}
                  success={completionReviewSuccess}
                  onSubmit={handleCompletionReviewSubmit}
                  onApprove={handleCompletionReviewApprove}
                  onReturn={handleCompletionReviewReturn}
                />
              </div>

              <aside className="space-y-4">
                <JobAssignmentCard
                  job={job}
                  onJobChange={(updatedJob) => {
                    queryClient.setQueryData(
                      queryKeys.jobs.detail(queryScope, updatedJob.id),
                      updatedJob,
                    );
                  }}
                />
                <JobEvidencePanel
                  items={evidence}
                  canUpload={canManageEvidence}
                  isLoading={evidenceQuery.isLoading}
                  isUploading={uploadEvidenceMutation.isPending}
                  error={evidenceError ?? evidenceRequestError}
                  onUpload={handleEvidenceUpload}
                  onDelete={handleEvidenceDelete}
                  onDownload={handleEvidenceDownload}
                />
                <WorkflowActivityCard history={workflow?.history ?? []} />
              </aside>
            </div>
          </div>
        ) : null}
      </AuthGuard>
    </AppShell>
  );
}
