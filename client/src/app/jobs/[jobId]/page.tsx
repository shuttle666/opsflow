"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
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
import {
  deleteJobEvidenceRequest,
  downloadJobEvidenceRequest,
  approveJobCompletionReviewRequest,
  getLatestJobCompletionReviewRequest,
  getJobDetailRequest,
  getJobHistoryRequest,
  listJobEvidenceRequest,
  returnJobCompletionReviewRequest,
  submitJobCompletionReviewRequest,
  transitionJobStatusRequest,
  uploadJobEvidenceRequest,
} from "@/features/job/job-api";
import { formatDateTime, formatScheduleRange } from "@/features/job";
import { useAuthStore } from "@/store/auth-store";
import type {
  JobDetail,
  JobCompletionReviewItem,
  JobCompletionReviewMutationResult,
  JobEvidenceItem,
  JobHistoryItem,
  JobHistoryResult,
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
}: {
  eyebrow?: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(surfaceClassName, className?.includes("p-0") ? "p-0" : "p-4", className)}>
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
    <DetailCard eyebrow="Activity" title="Recent workflow activity">
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
  const [job, setJob] = useState<JobDetail | null>(null);
  const [workflow, setWorkflow] = useState<JobHistoryResult | null>(null);
  const [completionReview, setCompletionReview] = useState<JobCompletionReviewItem | null>(null);
  const [evidence, setEvidence] = useState<JobEvidenceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowSuccess, setWorkflowSuccess] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [completionReviewError, setCompletionReviewError] = useState<string | null>(null);
  const [completionReviewSuccess, setCompletionReviewSuccess] = useState<string | null>(null);
  const [isSubmittingCompletionReview, setIsSubmittingCompletionReview] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [isEvidenceLoading, setIsEvidenceLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!jobId) {
      setError("Job id is missing.");
      setIsLoading(false);
      setIsEvidenceLoading(false);
      return;
    }

    void (async () => {
      setIsLoading(true);
      setIsEvidenceLoading(true);
      setError(null);

      try {
        const [loadedJob, loadedHistory, loadedEvidence, loadedCompletionReview] = await Promise.all([
          withAccessTokenRetry((accessToken) => getJobDetailRequest(accessToken, jobId)),
          withAccessTokenRetry((accessToken) => getJobHistoryRequest(accessToken, jobId)),
          withAccessTokenRetry((accessToken) => listJobEvidenceRequest(accessToken, jobId)),
          withAccessTokenRetry((accessToken) =>
            getLatestJobCompletionReviewRequest(accessToken, jobId),
          ),
        ]);

        if (!cancelled) {
          setJob(loadedJob);
          setWorkflow(loadedHistory);
          setEvidence(loadedEvidence);
          setCompletionReview(loadedCompletionReview);
          setWorkflowError(null);
          setWorkflowSuccess(null);
          setCompletionReviewError(null);
          setCompletionReviewSuccess(null);
          setEvidenceError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load job.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsEvidenceLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId, withAccessTokenRetry]);

  const canEdit = canManageJobs(currentTenant?.role);
  const canManageEvidence = job
    ? canTransitionJobs(currentTenant?.role, user?.id, job)
    : false;
  const canTransition = job
    ? canTransitionJobs(currentTenant?.role, user?.id, job)
    : false;

  const transitionActions =
    canTransition && workflow ? getTransitionActions(workflow.allowedTransitions) : [];

  function applyCompletionReviewMutation(result: JobCompletionReviewMutationResult) {
    setJob(result.job);
    setCompletionReview(result.review);
    setWorkflow((current) => ({
      history: [...(current?.history ?? []), result.historyEntry],
      allowedTransitions: result.allowedTransitions,
    }));
  }

  async function handleTransition(action: TransitionActionView, reason?: string) {
    if (!job) {
      return;
    }

    setIsTransitioning(true);
    setWorkflowError(null);
    setWorkflowSuccess(null);

    try {
      const transitioned = await withAccessTokenRetry((accessToken) =>
        transitionJobStatusRequest(accessToken, job.id, {
          toStatus: action.toStatus,
          ...(reason ? { reason } : {}),
        }),
      );

      setJob(transitioned.job);
      setWorkflow((current) => ({
        history: [...(current?.history ?? []), transitioned.historyEntry],
        allowedTransitions: transitioned.allowedTransitions,
      }));
      setWorkflowSuccess(`Job moved to ${formatStatusLabel(action.toStatus)}.`);
    } catch (transitionError) {
      setWorkflowError(
        transitionError instanceof Error
          ? transitionError.message
          : "Failed to update job workflow.",
      );
    } finally {
      setIsTransitioning(false);
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

    setIsUploadingEvidence(true);
    setEvidenceError(null);

    try {
      const created = await withAccessTokenRetry((accessToken) =>
        uploadJobEvidenceRequest(accessToken, job.id, input),
      );
      setEvidence((current) => [created, ...current]);
    } catch (uploadError) {
      setEvidenceError(
        uploadError instanceof Error ? uploadError.message : "Failed to upload evidence.",
      );
      throw uploadError;
    } finally {
      setIsUploadingEvidence(false);
    }
  }

  async function handleCompletionReviewSubmit(completionNote: string) {
    if (!job) {
      return;
    }

    setIsSubmittingCompletionReview(true);
    setCompletionReviewError(null);
    setCompletionReviewSuccess(null);

    try {
      const result = await withAccessTokenRetry((accessToken) =>
        submitJobCompletionReviewRequest(accessToken, job.id, { completionNote }),
      );
      applyCompletionReviewMutation(result);
      setCompletionReviewSuccess("Completion submitted for review.");
    } catch (submitError) {
      setCompletionReviewError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit completion for review.",
      );
      throw submitError;
    } finally {
      setIsSubmittingCompletionReview(false);
    }
  }

  async function handleCompletionReviewApprove(review: JobCompletionReviewItem) {
    if (!job) {
      return;
    }

    setIsSubmittingCompletionReview(true);
    setCompletionReviewError(null);
    setCompletionReviewSuccess(null);

    try {
      const result = await withAccessTokenRetry((accessToken) =>
        approveJobCompletionReviewRequest(accessToken, job.id, review.id),
      );
      applyCompletionReviewMutation(result);
      setCompletionReviewSuccess("Completion approved.");
    } catch (approveError) {
      setCompletionReviewError(
        approveError instanceof Error
          ? approveError.message
          : "Failed to approve completion.",
      );
      throw approveError;
    } finally {
      setIsSubmittingCompletionReview(false);
    }
  }

  async function handleCompletionReviewReturn(
    review: JobCompletionReviewItem,
    reviewNote: string,
  ) {
    if (!job) {
      return;
    }

    setIsSubmittingCompletionReview(true);
    setCompletionReviewError(null);
    setCompletionReviewSuccess(null);

    try {
      const result = await withAccessTokenRetry((accessToken) =>
        returnJobCompletionReviewRequest(accessToken, job.id, review.id, { reviewNote }),
      );
      applyCompletionReviewMutation(result);
      setCompletionReviewSuccess("Completion returned for rework.");
    } catch (returnError) {
      setCompletionReviewError(
        returnError instanceof Error
          ? returnError.message
          : "Failed to return completion for rework.",
      );
      throw returnError;
    } finally {
      setIsSubmittingCompletionReview(false);
    }
  }

  async function handleEvidenceDelete(evidenceId: string) {
    if (!job) {
      return;
    }

    setEvidenceError(null);

    try {
      await withAccessTokenRetry((accessToken) =>
        deleteJobEvidenceRequest(accessToken, job.id, evidenceId),
      );
      setEvidence((current) => current.filter((item) => item.id !== evidenceId));
    } catch (deleteError) {
      setEvidenceError(
        deleteError instanceof Error ? deleteError.message : "Failed to delete evidence.",
      );
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
        {isLoading ? <LoadingPanel label="Loading job..." /> : null}
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
                  canShowManualControls={canEdit}
                  isSubmitting={isTransitioning}
                  error={workflowError}
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
                  error={completionReviewError}
                  success={completionReviewSuccess}
                  onSubmit={handleCompletionReviewSubmit}
                  onApprove={handleCompletionReviewApprove}
                  onReturn={handleCompletionReviewReturn}
                />
              </div>

              <aside className="space-y-4">
                <JobAssignmentCard job={job} onJobChange={setJob} />
                <JobEvidencePanel
                  items={evidence}
                  canUpload={canManageEvidence}
                  isLoading={isEvidenceLoading}
                  isUploading={isUploadingEvidence}
                  error={evidenceError}
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
