"use client";

import { useState } from "react";
import { ActionCard } from "@/components/ui/info-cards";
import {
  cn,
  primaryButtonClassName,
  secondaryButtonClassName,
  selectClassName,
  surfaceClassName,
} from "@/components/ui/styles";
import { useJobAssignmentMutation } from "@/features/job/job-assignment-queries";
import { useMembershipsQuery } from "@/features/membership/membership-queries";
import { useAuthStore } from "@/store/auth-store";
import type { JobDetail } from "@/types/job";

type JobAssignmentCardProps = {
  job: JobDetail;
  onJobChange: (job: JobDetail) => void;
};

function canAssign(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

export function JobAssignmentCard({ job, onJobChange }: JobAssignmentCardProps) {
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const [selectedMembershipId, setSelectedMembershipId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const assignable = canAssign(currentTenant?.role);
  const staffQuery = useMembershipsQuery(
    {
      status: "ACTIVE",
      role: "STAFF",
      page: 1,
      pageSize: 50,
    },
    assignable,
  );
  const staffMembers = staffQuery.data?.items ?? [];
  const assignedMembershipId = staffMembers.find(
    (membership) => membership.userId === job.assignedTo?.id,
  )?.id;
  const effectiveSelectedMembershipId = staffMembers.some(
    (membership) => membership.id === selectedMembershipId,
  )
    ? selectedMembershipId
    : assignedMembershipId ?? staffMembers[0]?.id ?? "";
  const assignmentMutation = useJobAssignmentMutation();
  const isLoading = assignable && staffQuery.isLoading;
  const isSubmitting = assignmentMutation.isPending;
  const error =
    actionError ??
    (staffQuery.error
      ? staffQuery.error.message || "Failed to load assignable staff members."
      : null);

  return (
    <ActionCard
      eyebrow="Assignment"
      title="Staff assignment"
      description="Current owner for field work and handoff."
    >
      <div className="space-y-4 text-sm text-[var(--color-text-secondary)]">
        <div className={cn(surfaceClassName, "flex items-center gap-3 p-4 shadow-none")}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-soft)] text-sm font-bold text-[var(--color-brand)]">
            {(job.assignedTo?.displayName ?? "U").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
              Current assignee
            </p>
            <p className="truncate text-sm font-bold text-[var(--color-text)]">
              {job.assignedTo?.displayName ?? "Unassigned"}
            </p>
            {job.assignedTo?.email ? (
              <p className="truncate text-xs text-[var(--color-text-secondary)]">
                {job.assignedTo.email}
              </p>
            ) : null}
          </div>
        </div>

        {!assignable ? (
          <p className="text-[var(--color-text-secondary)]">
            Your current role can review the assignee but cannot change it.
          </p>
        ) : (
          <>
            {isLoading ? (
              <p className="text-[var(--color-text-secondary)]">Loading staff members...</p>
            ) : null}

            {!isLoading && staffMembers.length === 0 ? (
              <p className="text-[var(--color-text-secondary)]">
                No active staff members are available yet.
              </p>
            ) : null}

            {staffMembers.length > 0 ? (
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">
                  Assign to staff
                </span>
                <select
                  value={effectiveSelectedMembershipId}
                  onChange={(event) => setSelectedMembershipId(event.target.value)}
                  className={selectClassName}
                >
                  {staffMembers.map((membership) => (
                    <option key={membership.id} value={membership.id}>
                      {membership.displayName} ({membership.email})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={isSubmitting || !effectiveSelectedMembershipId}
                onClick={() => {
                  setActionError(null);
                  setSuccess(null);
                  assignmentMutation.mutate(
                    {
                      action: "assign",
                      jobId: job.id,
                      membershipId: effectiveSelectedMembershipId,
                    },
                    {
                      onSuccess: (updated) => {
                        onJobChange(updated);
                        setSuccess("Job assigned successfully.");
                      },
                      onError: (submitError) => {
                        setActionError(
                          submitError instanceof Error
                            ? submitError.message
                            : "Failed to assign job.",
                        );
                      },
                    },
                  );
                }}
                className={primaryButtonClassName}
              >
                {isSubmitting ? "Working..." : "Assign"}
              </button>

              {job.assignedTo ? (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setActionError(null);
                    setSuccess(null);
                    assignmentMutation.mutate(
                      { action: "unassign", jobId: job.id },
                      {
                        onSuccess: (updated) => {
                          onJobChange(updated);
                          setSuccess("Job unassigned.");
                        },
                        onError: (submitError) => {
                          setActionError(
                            submitError instanceof Error
                              ? submitError.message
                              : "Failed to unassign job.",
                          );
                        },
                      },
                    );
                  }}
                  className={secondaryButtonClassName}
                >
                  {isSubmitting ? "Working..." : "Unassign"}
                </button>
              ) : null}
            </div>
          </>
        )}

        {error ? <p className="text-[var(--color-danger)]">{error}</p> : null}
        {success ? <p className="text-[var(--color-success)]">{success}</p> : null}
      </div>
    </ActionCard>
  );
}
