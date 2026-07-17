"use client";

import { useState } from "react";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { primaryButtonClassName } from "@/components/ui/styles";
import {
  useAcceptInvitationByIdMutation,
  useMyInvitationsQuery,
} from "@/features/auth/auth-queries";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function InvitationInboxCard() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const invitationsQuery = useMyInvitationsQuery();
  const acceptMutation = useAcceptInvitationByIdMutation();
  const invitations = invitationsQuery.data ?? [];
  const queryError = invitationsQuery.error?.message ?? null;
  const visibleError = error ?? queryError;

  return (
    <SectionCard
      eyebrow="Invitation inbox"
      title="Pending invitations"
      description="Invitations sent to your account email can be accepted in one click."
    >
      {invitationsQuery.isPending ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Loading invitations...</p>
      ) : null}

      {visibleError ? <p className="text-sm text-rose-600">{visibleError}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

      {!invitationsQuery.isPending && !visibleError && invitations.length === 0 ? (
        <EmptyStatePanel
          compact
          title="No pending invitations right now."
          description="When another tenant invites this account, the one-click accept flow will appear here."
        />
      ) : null}

      <div className="space-y-3">
        {invitations.map((invitation) => (
        <div
          key={invitation.id}
          className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  {invitation.tenantName}
                </p>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge kind="role" value={invitation.role} />
                  <StatusBadge kind="invitation" value={invitation.status} />
                </div>
                <p className="font-mono text-[10px] uppercase text-[var(--color-text-muted)]">
                  Expires {formatDate(invitation.expiresAt)}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={
                  acceptMutation.isPending &&
                  acceptMutation.variables === invitation.id
                }
                onClick={() => {
                  setSuccess(null);
                  setError(null);
                  void acceptMutation.mutateAsync(invitation.id)
                    .then((result) => {
                      setSuccess(
                        `Joined tenant ${result.tenantId} as ${result.role}.`,
                      );
                    })
                    .catch((submitError) => {
                      const message =
                        submitError instanceof Error
                          ? submitError.message
                          : "Failed to accept invitation.";
                      setError(message);
                    });
                }}
                className={primaryButtonClassName}
              >
                {acceptMutation.isPending &&
                acceptMutation.variables === invitation.id
                  ? "Accepting..."
                  : "Accept"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
