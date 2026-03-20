"use client";

import { useCallback, useEffect, useState } from "react";
import { SectionCard } from "@/components/ui/section-card";
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
      description="Invitations sent to your account email show up here. Accept in one click, no manual token paste required."
    >
      {isLoading ? (
        <p className="text-sm text-slate-600">Loading invitations...</p>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

      {!isLoading && invitations.length === 0 ? (
        <p className="text-sm text-slate-600">No pending invitations right now.</p>
      ) : null}

      <div className="space-y-3">
        {invitations.map((invitation) => (
          <div
            key={invitation.id}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <p className="text-sm font-semibold text-slate-900">
              {invitation.tenantName}
            </p>
            <p className="text-xs text-slate-600">
              Role: {invitation.role} | Expires: {formatDate(invitation.expiresAt)}
            </p>
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
                className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
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
