"use client";

import { useState } from "react";
import { StaffSearchSelect } from "@/components/team/staff-search-select";
import { ActionCard } from "@/components/ui/info-cards";
import {
  cn,
  primaryButtonClassName,
  secondaryButtonClassName,
  surfaceClassName,
} from "@/components/ui/styles";
import { useJobAssignmentMutation } from "@/features/job/job-assignment-queries";
import { useAuthStore } from "@/store/auth-store";
import type { JobDetail } from "@/types/job";
import type { MembershipListItem } from "@/types/membership";

type JobAssignmentCardProps = {
  job: JobDetail;
  onJobChange: (job: JobDetail) => void;
};

function canAssign(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

export function JobAssignmentCard({ job, onJobChange }: JobAssignmentCardProps) {
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const [selectedMembership, setSelectedMembership] =
    useState<MembershipListItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const assignable = canAssign(currentTenant?.role);
  const assignmentMutation = useJobAssignmentMutation();
  const isSubmitting = assignmentMutation.isPending;
  const error = actionError;

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
            <StaffSearchSelect
              label="Assign to staff"
              value={selectedMembership?.id ?? ""}
              selectedMembership={selectedMembership}
              onChange={(_membershipId, membership) => {
                setSelectedMembership(membership ?? null);
              }}
            />

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={isSubmitting || !selectedMembership}
                onClick={() => {
                  if (!selectedMembership) {
                    return;
                  }
                  setActionError(null);
                  setSuccess(null);
                  assignmentMutation.mutate(
                    {
                      action: "assign",
                      jobId: job.id,
                      membershipId: selectedMembership.id,
                    },
                    {
                      onSuccess: (updated) => {
                        setSelectedMembership(null);
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
