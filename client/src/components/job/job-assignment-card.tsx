"use client";

import { useEffect, useState } from "react";
import { ActionCard } from "@/components/ui/info-cards";
import {
  cn,
  primaryButtonClassName,
  secondaryButtonClassName,
  selectClassName,
  surfaceClassName,
} from "@/components/ui/styles";
import {
  assignJobRequest,
  unassignJobRequest,
} from "@/features/job/job-api";
import { listMembershipsRequest } from "@/features/membership";
import { useAuthStore } from "@/store/auth-store";
import type { MembershipListItem } from "@/types/membership";
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
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const [staffMembers, setStaffMembers] = useState<MembershipListItem[]>([]);
  const [selectedMembershipId, setSelectedMembershipId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const assignable = canAssign(currentTenant?.role);

  useEffect(() => {
    if (!assignable) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await withAccessTokenRetry((accessToken) =>
          listMembershipsRequest(accessToken, {
            status: "ACTIVE",
            role: "STAFF",
            page: 1,
            pageSize: 50,
          }),
        );

        if (!cancelled) {
          setStaffMembers(result.items);
          const selected = result.items.find(
            (membership) => membership.userId === job.assignedTo?.id,
          );
          setSelectedMembershipId(selected?.id ?? result.items[0]?.id ?? "");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load assignable staff members.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assignable, job.assignedTo?.id, withAccessTokenRetry]);

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
                  value={selectedMembershipId}
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
                disabled={isSubmitting || !selectedMembershipId}
                onClick={() => {
                  setIsSubmitting(true);
                  setError(null);
                  setSuccess(null);
                  void withAccessTokenRetry((accessToken) =>
                    assignJobRequest(accessToken, job.id, {
                      membershipId: selectedMembershipId,
                    }),
                  )
                    .then((updated) => {
                      onJobChange(updated);
                      setSuccess("Job assigned successfully.");
                    })
                    .catch((submitError) => {
                      setError(
                        submitError instanceof Error
                          ? submitError.message
                          : "Failed to assign job.",
                      );
                    })
                    .finally(() => {
                      setIsSubmitting(false);
                    });
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
                    setIsSubmitting(true);
                    setError(null);
                    setSuccess(null);
                    void withAccessTokenRetry((accessToken) =>
                      unassignJobRequest(accessToken, job.id),
                    )
                      .then((updated) => {
                        onJobChange(updated);
                        setSuccess("Job unassigned.");
                      })
                      .catch((submitError) => {
                        setError(
                          submitError instanceof Error
                            ? submitError.message
                            : "Failed to unassign job.",
                        );
                      })
                      .finally(() => {
                        setIsSubmitting(false);
                      });
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
