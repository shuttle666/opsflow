"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { primaryButtonClassName } from "@/components/ui/styles";
import { useAuthStore } from "@/store/auth-store";
import type { MyInvitationItem } from "@/types/auth";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function InvitationInboxCard() {
  const listMyInvitations = useAuthStore((state) => state.listMyInvitations);
  const acceptInvitationById = useAuthStore((state) => state.acceptInvitationById);
  const [invitations, setInvitations] = useState<MyInvitationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    const rows = await listMyInvitations();
    setInvitations(rows);
  }, [listMyInvitations]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const rows = await listMyInvitations();
        if (!cancelled) {
          setInvitations(rows);
        }
      } catch (loadError) {
        if (!cancelled) {
          const message =
            loadError instanceof Error
              ? loadError.message
              : "Failed to load pending invitations.";
          setError(message);
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
  }, [listMyInvitations]);

  return (
    <SectionCard
      eyebrow="Invitation inbox"
      title="Pending invitations"
      description="Invitations sent to your account email can be accepted in one click."
    >
      {isLoading ? (
        <p className="text-sm text-slate-600">Loading invitations...</p>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

      {!isLoading && invitations.length === 0 ? (
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
          className="rounded-[24px] border border-white/70 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">
                  {invitation.tenantName}
                </p>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge kind="role" value={invitation.role} />
                  <StatusBadge kind="invitation" value={invitation.status} />
                </div>
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-400">
                  Expires {formatDate(invitation.expiresAt)}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={actingId === invitation.id}
                onClick={() => {
                  setSuccess(null);
                  setError(null);
                  setActingId(invitation.id);
                  void acceptInvitationById(invitation.id)
                    .then((result) => {
                      setSuccess(
                        `Joined tenant ${result.tenantId} as ${result.role}.`,
                      );
                      return reload();
                    })
                    .catch((submitError) => {
                      const message =
                        submitError instanceof Error
                          ? submitError.message
                          : "Failed to accept invitation.";
                      setError(message);
                    })
                    .finally(() => {
                      setActingId(null);
                    });
                }}
                className={primaryButtonClassName}
              >
                {actingId === invitation.id ? "Accepting..." : "Accept"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
