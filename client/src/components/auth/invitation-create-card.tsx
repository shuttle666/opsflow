"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { SectionCard } from "@/components/ui/section-card";
import {
  invitationCreateSchema,
  type InvitationCreateFormValues,
} from "@/features/auth";
import { useAuthStore } from "@/store/auth-store";
import type { MembershipRole, TenantInvitationItem } from "@/types/auth";

const INVITER_ROLES: MembershipRole[] = ["OWNER", "MANAGER"];

function canCreateInvitation(role: MembershipRole | undefined) {
  if (!role) {
    return false;
  }

  return INVITER_ROLES.includes(role);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function InvitationCreateCard() {
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const createInvitation = useAuthStore((state) => state.createInvitation);
  const listTenantInvitations = useAuthStore((state) => state.listTenantInvitations);
  const resendInvitation = useAuthStore((state) => state.resendInvitation);
  const cancelInvitation = useAuthStore((state) => state.cancelInvitation);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<TenantInvitationItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<InvitationCreateFormValues>({
    resolver: zodResolver(invitationCreateSchema),
    defaultValues: {
      email: "",
      role: "STAFF",
    },
  });

  const reloadInvitations = useCallback(async () => {
    setLoadingList(true);

    try {
      const rows = await listTenantInvitations();
      setInvitations(rows);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load tenant invitations.";
      setError(message);
    } finally {
      setLoadingList(false);
    }
  }, [listTenantInvitations]);

  const currentTenantId = currentTenant?.tenantId;
  const currentRole = currentTenant?.role;

  useEffect(() => {
    if (!currentTenantId || !canCreateInvitation(currentRole)) {
      return;
    }

    void reloadInvitations();
  }, [currentTenantId, currentRole, reloadInvitations]);

  if (!currentTenant) {
    return (
      <SectionCard
        eyebrow="Team access"
        title="Invitation management"
        description="Tenant context is not available yet."
      >
        <p className="text-sm text-slate-600">Please refresh your session first.</p>
      </SectionCard>
    );
  }

  const allowed = canCreateInvitation(currentTenant.role);
  if (!allowed) {
    return (
      <SectionCard
        eyebrow="Team access"
        title="Invitation management"
        description="Only OWNER or MANAGER can invite members in this tenant."
      >
        <p className="text-sm text-slate-600">
          Your current role is <span className="font-semibold">{currentTenant.role}</span>.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      eyebrow="Team access"
      title="Invitation management"
      description="Create, review, resend, and cancel invitations directly from Dashboard."
    >
      <form
        className="space-y-4"
        onSubmit={handleSubmit(async (values) => {
          setError(null);
          setSuccess(null);

          try {
            const result = await createInvitation(values);
            setSuccess(
              `Invitation created for ${result.email} (${result.role}), expires at ${formatDate(result.expiresAt)}.`,
            );
            reset({
              email: "",
              role: values.role,
            });
            await reloadInvitations();
          } catch (submitError) {
            const message =
              submitError instanceof Error
                ? submitError.message
                : "Failed to create invitation.";
            setError(message);
          }
        })}
      >
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Invitee email</span>
          <input
            {...register("email")}
            placeholder="new.member@example.com"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          />
          {errors.email ? (
            <p className="text-sm text-rose-600">{errors.email.message}</p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Role</span>
          <select
            {...register("role")}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          >
            <option value="MANAGER">MANAGER</option>
            <option value="STAFF">STAFF</option>
          </select>
          {errors.role ? (
            <p className="text-sm text-rose-600">{errors.role.message}</p>
          ) : null}
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? "Creating..." : "Create invitation"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
      {success ? <p className="mt-4 text-sm text-emerald-700">{success}</p> : null}

      <div className="mt-6 space-y-3">
        <p className="text-sm font-semibold text-slate-800">Invitation list</p>

        {loadingList ? (
          <p className="text-sm text-slate-600">Loading invitations...</p>
        ) : null}

        {!loadingList && invitations.length === 0 ? (
          <p className="text-sm text-slate-600">No invitations yet.</p>
        ) : null}

        {invitations.map((invitation) => (
          <div
            key={invitation.id}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm"
          >
            <p className="font-semibold text-slate-900">{invitation.email}</p>
            <p className="text-slate-600">
              Role: {invitation.role} | Status: {invitation.status}
            </p>
            <p className="text-slate-600">Expires: {formatDate(invitation.expiresAt)}</p>
            <p className="text-slate-600">
              Invited by: {invitation.invitedBy.displayName} ({invitation.invitedBy.email})
            </p>

            {invitation.status === "PENDING" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={actingId === invitation.id}
                  onClick={() => {
                    setError(null);
                    setSuccess(null);
                    setActingId(invitation.id);
                    void resendInvitation(invitation.id)
                      .then(async (result) => {
                        setSuccess(
                          `Invitation resent. New expiry: ${formatDate(result.expiresAt)}.`,
                        );
                        await reloadInvitations();
                      })
                      .catch((actionError) => {
                        const message =
                          actionError instanceof Error
                            ? actionError.message
                            : "Failed to resend invitation.";
                        setError(message);
                      })
                      .finally(() => {
                        setActingId(null);
                      });
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actingId === invitation.id ? "Working..." : "Resend"}
                </button>

                <button
                  type="button"
                  disabled={actingId === invitation.id}
                  onClick={() => {
                    setError(null);
                    setSuccess(null);
                    setActingId(invitation.id);
                    void cancelInvitation(invitation.id)
                      .then(async () => {
                        setSuccess("Invitation cancelled.");
                        await reloadInvitations();
                      })
                      .catch((actionError) => {
                        const message =
                          actionError instanceof Error
                            ? actionError.message
                            : "Failed to cancel invitation.";
                        setError(message);
                      })
                      .finally(() => {
                        setActingId(null);
                      });
                  }}
                  className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actingId === invitation.id ? "Working..." : "Cancel"}
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
