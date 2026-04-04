"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { JobEvidencePanel } from "@/components/job/job-evidence-panel";
import { JobAssignmentCard } from "@/components/job/job-assignment-card";
import { WorkflowTimelineCard } from "@/components/job/workflow-timeline-card";
import { AppShell } from "@/components/ui/app-shell";
import { DetailLayout } from "@/components/ui/detail-layout";
import { SummaryCard } from "@/components/ui/info-cards";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { secondaryButtonClassName } from "@/components/ui/styles";
import {
  deleteJobEvidenceRequest,
  downloadJobEvidenceRequest,
  getJobDetailRequest,
  getJobHistoryRequest,
  listJobEvidenceRequest,
  transitionJobStatusRequest,
  uploadJobEvidenceRequest,
} from "@/features/job/job-api";
import { formatDateTime, formatScheduleRange } from "@/features/job";
import { useAuthStore } from "@/store/auth-store";
import type {
  JobDetail,
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
  const allStatuses = [
    { status: "NEW", label: "New" },
    { status: "SCHEDULED", label: "Scheduled" },
    { status: "IN_PROGRESS", label: "In progress" },
    { status: "COMPLETED", label: "Completed" },
    { status: "CANCELLED", label: "Cancelled" },
  ] as const satisfies Array<{ status: JobStatus; label: string }>;

  const currentIndex = allStatuses.findIndex((item) => item.status === job.status);
  const historyByStatus = new Map(history.map((item) => [item.toStatus, item]));

  return allStatuses.map((item, index) => ({
    id: item.status,
    label: item.label,
    status: item.status,
    timestamp:
      item.status === "NEW"
        ? formatDateTime(job.createdAt)
        : formatDateTime(historyByStatus.get(item.status)?.changedAt ?? null),
    description:
      item.status === "NEW"
        ? formatHistoryDescription(undefined, job)
        : formatHistoryDescription(historyByStatus.get(item.status)),
    state:
      index < currentIndex
        ? "completed"
        : index === currentIndex
          ? "current"
          : "upcoming",
  }));
}

function getTransitionAction(status: JobStatus): TransitionActionView {
  switch (status) {
    case "SCHEDULED":
      return { id: "schedule", label: "Move to scheduled", toStatus: "SCHEDULED" };
    case "IN_PROGRESS":
      return { id: "start", label: "Start work", toStatus: "IN_PROGRESS" };
    case "COMPLETED":
      return {
        id: "complete",
        label: "Complete job",
        toStatus: "COMPLETED",
        requiresNote: true,
      };
    case "CANCELLED":
      return {
        id: "cancel",
        label: "Cancel job",
        toStatus: "CANCELLED",
        requiresReason: true,
      };
    case "NEW":
      return { id: "new", label: "Mark as new", toStatus: "NEW" };
  }
}

function getTransitionActions(statuses: JobStatus[]): TransitionActionView[] {
  return statuses.map((status) => getTransitionAction(status));
}

export default function JobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = typeof params.jobId === "string" ? params.jobId : "";
  const user = useAuthStore((state) => state.user);
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [workflow, setWorkflow] = useState<JobHistoryResult | null>(null);
  const [evidence, setEvidence] = useState<JobEvidenceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowSuccess, setWorkflowSuccess] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
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
        const [loadedJob, loadedHistory, loadedEvidence] = await Promise.all([
          withAccessTokenRetry((accessToken) => getJobDetailRequest(accessToken, jobId)),
          withAccessTokenRetry((accessToken) => getJobHistoryRequest(accessToken, jobId)),
          withAccessTokenRetry((accessToken) => listJobEvidenceRequest(accessToken, jobId)),
        ]);

        if (!cancelled) {
          setJob(loadedJob);
          setWorkflow(loadedHistory);
          setEvidence(loadedEvidence);
          setWorkflowError(null);
          setWorkflowSuccess(null);
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
    <AppShell
      title={job?.title ?? "Job detail"}
      actions={
        job && canEdit ? (
          <Link href={`/jobs/${job.id}/edit`} className={secondaryButtonClassName}>
            Edit job
          </Link>
        ) : undefined
      }
    >
      <AuthGuard>
        {isLoading ? <LoadingPanel label="Loading job..." /> : null}
        {error ? <InlineErrorBanner message={error} /> : null}

        {job ? (
          <DetailLayout
            main={
              <>
                <SummaryCard
                  eyebrow="Overview"
                  title={job.title}
                >
                  <div className="space-y-5">
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge kind="job" value={job.status} />
                    </div>

                    <div className="rounded-[24px] border border-white/75 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Customer
                      </p>
                      <p className="mt-3 text-sm font-semibold text-slate-900">
                        {job.customer.name}
                      </p>
                      <div className="mt-3 space-y-1 text-sm text-slate-700">
                        <p>Phone: {job.customer.phone ?? "-"}</p>
                        <p>Email: {job.customer.email ?? "-"}</p>
                      </div>
                      <div className="mt-4">
                        <Link href={`/customers/${job.customer.id}`} className={secondaryButtonClassName}>
                          Open customer detail
                        </Link>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-white/75 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Scheduled window
                      </p>
                      <p className="mt-3 text-sm text-slate-700">
                        {formatScheduleRange(job.scheduledStartAt, job.scheduledEndAt)}
                      </p>
                      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Description
                      </p>
                      <p className="mt-3 text-sm leading-7 text-slate-500">
                        {job.description ?? "No job description has been captured yet."}
                      </p>
                    </div>
                  </div>
                </SummaryCard>

                <WorkflowTimelineCard
                  items={workflow ? getTimelineItems(job, workflow.history) : []}
                  actions={transitionActions}
                  currentStatusLabel={formatStatusLabel(job.status)}
                  isSubmitting={isTransitioning}
                  error={workflowError}
                  success={workflowSuccess}
                  readOnlyMessage={
                    !canTransition && workflow?.allowedTransitions?.length
                      ? "Your current role can review this workflow but cannot advance this job."
                      : null
                  }
                  onTransition={handleTransition}
                />
              </>
            }
            sidebar={
              <>
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
              </>
            }
          />
        ) : null}
      </AuthGuard>
    </AppShell>
  );
}
