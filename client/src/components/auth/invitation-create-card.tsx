"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { FormActions, FormSection } from "@/components/ui/form-surface";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  invitationCreateSchema,
  type InvitationCreateFormValues,
} from "@/features/auth";
import { useAuthStore } from "@/store/auth-store";
import type { MembershipRole, TenantInvitationItem } from "@/types/auth";
import {
  inputClassName,
  primaryButtonClassName,
  selectClassName,
  secondaryButtonClassName,
  subtleButtonClassName,
} from "@/components/ui/styles";

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
        <p className="text-sm text-[var(--color-text-secondary)]">Please refresh your session first.</p>
      </SectionCard>
    );
  }

  const allowed = canCreateInvitation(currentTenant.role);
  if (!allowed) {
    return (
      <SectionCard
        eyebrow="Team access"
        title="Invitation management"
      description="Only owner and manager roles can invite new members."
    >
      <p className="text-sm text-[var(--color-text-secondary)]">
        Your current role is <span className="font-semibold">{currentTenant.role}</span>.
      </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      eyebrow="Team access"
      title="Invite new members"
      description="Send workspace access to managers and staff, then keep pending invites moving."
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
        <FormSection
          title="Create invitation"
          description="Send access directly from the workspace without leaving the current tenant."
        >
          <div className="grid gap-4 md:grid-cols-[1.4fr_0.8fr]">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">Invitee email</span>
              <input
                {...register("email")}
                placeholder="new.member@example.com"
                className={inputClassName}
              />
              {errors.email ? (
                <p className="text-sm text-rose-600">{errors.email.message}</p>
              ) : null}
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">Role</span>
              <select {...register("role")} className={selectClassName}>
                <option value="MANAGER">MANAGER</option>
                <option value="STAFF">STAFF</option>
              </select>
              {errors.role ? (
                <p className="text-sm text-rose-600">{errors.role.message}</p>
              ) : null}
            </label>
          </div>
        </FormSection>

        <FormActions>
          <button
            type="submit"
            disabled={isSubmitting}
            className={primaryButtonClassName}
          >
            {isSubmitting ? "Creating..." : "Create invitation"}
          </button>
        </FormActions>
      </form>

      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
      {success ? <p className="mt-4 text-sm text-emerald-700">{success}</p> : null}

      <div className="mt-6 space-y-3">
        <p className="text-sm font-semibold text-[var(--color-text)]">Pending invitations</p>

        {loadingList ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Loading invitations...</p>
        ) : null}

        {!loadingList && invitations.length === 0 ? (
          <EmptyStatePanel
            compact
            title="No invitations yet"
            description="As you invite managers and staff, pending invitations will be tracked in this list."
          />
        ) : null}

        {invitations.map((invitation) => (
          <div
            key={invitation.id}
            className="rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] p-4 text-sm shadow-sm"
          >
            <p className="font-semibold text-[var(--color-text)]">{invitation.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge kind="role" value={invitation.role} />
              <StatusBadge kind="invitation" value={invitation.status} />
            </div>
            <p className="text-[var(--color-text-secondary)]">Expires: {formatDate(invitation.expiresAt)}</p>
            <p className="text-[var(--color-text-secondary)]">
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
                  className={subtleButtonClassName}
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
                  className={secondaryButtonClassName}
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
