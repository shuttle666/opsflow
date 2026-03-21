"use client";

import { useEffect, useMemo, useState } from "react";
import { InvitationCreateCard } from "@/components/auth/invitation-create-card";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/ui/app-shell";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { SummaryCard } from "@/components/ui/info-cards";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  inputClassName,
  primaryButtonClassName,
  selectClassName,
  surfaceClassName,
  subtleButtonClassName,
} from "@/components/ui/styles";
import {
  listMembershipsRequest,
  updateMembershipRequest,
} from "@/features/membership";
import { useAuthStore } from "@/store/auth-store";
import type { PaginationMeta } from "@/types/customer";
import type { MembershipRole, MembershipStatus } from "@/types/auth";
import type { MembershipListItem } from "@/types/membership";

type MembershipDraft = {
  role: MembershipRole;
  status: Extract<MembershipStatus, "ACTIVE" | "DISABLED">;
};

const editableStatuses: Array<Extract<MembershipStatus, "ACTIVE" | "DISABLED">> = [
  "ACTIVE",
  "DISABLED",
];

function canReviewTeam(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

function canManageTeam(role: string | undefined) {
  return role === "OWNER";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function TeamPage() {
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const [memberships, setMemberships] = useState<MembershipListItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, MembershipDraft>>({});
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<MembershipStatus | "">("");
  const [roleFilter, setRoleFilter] = useState<MembershipRole | "">("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const allowReview = canReviewTeam(currentTenant?.role);
  const allowManage = canManageTeam(currentTenant?.role);

  useEffect(() => {
    if (!allowReview) {
      setMemberships([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await withAccessTokenRetry((accessToken) =>
          listMembershipsRequest(accessToken, {
            q: query,
            status: statusFilter || undefined,
            role: roleFilter || undefined,
            page,
            pageSize: 10,
          }),
        );

        if (!cancelled) {
          setMemberships(result.items);
          setPagination(result.pagination);
          setDrafts(
            Object.fromEntries(
              result.items
                .filter((membership) => membership.status !== "INVITED")
                .map((membership) => [
                  membership.id,
                  {
                    role: membership.role,
                    status:
                      membership.status === "DISABLED" ? "DISABLED" : "ACTIVE",
                  },
                ]),
            ),
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load team members.",
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
  }, [allowReview, page, query, roleFilter, statusFilter, withAccessTokenRetry]);

  const roleOptions = useMemo<MembershipRole[]>(() => ["OWNER", "MANAGER", "STAFF"], []);

  return (
    <AppShell
      title="Team Members"
    >
      <AuthGuard>
        {!allowReview ? (
          <EmptyStatePanel
            title="Team management is unavailable"
            description="Your current role cannot access team management in this tenant."
          />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className={`${surfaceClassName} p-6`}>
              <FilterToolbar>
                <form
                  className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_220px_220px_auto]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setPage(1);
                    setQuery(queryInput.trim());
                  }}
                >
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Search</span>
                    <input
                      value={queryInput}
                      onChange={(event) => setQueryInput(event.target.value)}
                      placeholder="Search team members..."
                      className={inputClassName}
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Status</span>
                    <select
                      value={statusFilter}
                      onChange={(event) => {
                        setPage(1);
                        setStatusFilter((event.target.value as MembershipStatus | "") || "");
                      }}
                      className={selectClassName}
                    >
                      <option value="">All statuses</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INVITED">INVITED</option>
                      <option value="DISABLED">DISABLED</option>
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Role</span>
                    <select
                      value={roleFilter}
                      onChange={(event) => {
                        setPage(1);
                        setRoleFilter((event.target.value as MembershipRole | "") || "");
                      }}
                      className={selectClassName}
                    >
                      <option value="">All roles</option>
                      <option value="OWNER">OWNER</option>
                      <option value="MANAGER">MANAGER</option>
                      <option value="STAFF">STAFF</option>
                    </select>
                  </label>

                  <div className="flex items-end">
                    <button type="submit" className={primaryButtonClassName}>
                      Apply
                    </button>
                  </div>
                </form>
              </FilterToolbar>

              <div className="mt-4 space-y-3">
                {error ? <InlineErrorBanner message={error} /> : null}
                {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
              </div>

              <div className="mt-6">
                {isLoading ? (
                  <LoadingPanel label="Loading team members..." />
                ) : memberships.length === 0 ? (
                  <EmptyStatePanel
                    title="No team members found"
                    description="Adjust the current search or invite new people into this workspace."
                  />
                ) : (
                  <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                    {memberships.map((membership) => {
                      const draft = drafts[membership.id];
                      const canEdit =
                        allowManage && membership.status !== "INVITED" && !!draft;
                      const changed =
                        !!draft &&
                        (draft.role !== membership.role || draft.status !== membership.status);

                      return (
                        <article
                          key={membership.id}
                          className="rounded-[28px] border border-white/75 bg-white p-6 shadow-sm"
                        >
                          <div className="flex flex-col items-center text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-2xl font-bold text-sky-700">
                              {initialsFor(membership.displayName)}
                            </div>
                            <p className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
                              {membership.displayName}
                            </p>
                            <p className="mt-2 text-sm text-slate-500">{membership.email}</p>
                            <p className="mt-2 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-400">
                              Joined {formatDate(membership.createdAt)}
                            </p>
                          </div>

                          <div className="mt-5 flex flex-wrap justify-center gap-2">
                            {!canEdit ? (
                              <>
                                <StatusBadge kind="role" value={membership.role} />
                                <StatusBadge kind="membership" value={membership.status} />
                              </>
                            ) : null}
                          </div>

                          {canEdit ? (
                            <div className="mt-5 space-y-3">
                              <label className="block space-y-2">
                                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                  Role
                                </span>
                                <select
                                  aria-label={`Role for ${membership.email}`}
                                  value={draft.role}
                                  onChange={(event) =>
                                    setDrafts((current) => ({
                                      ...current,
                                      [membership.id]: {
                                        ...draft,
                                        role: event.target.value as MembershipRole,
                                      },
                                    }))
                                  }
                                  className={selectClassName}
                                >
                                  {roleOptions.map((role) => (
                                    <option key={role} value={role}>
                                      {role}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="block space-y-2">
                                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                  Status
                                </span>
                                <select
                                  aria-label={`Status for ${membership.email}`}
                                  value={draft.status}
                                  onChange={(event) =>
                                    setDrafts((current) => ({
                                      ...current,
                                      [membership.id]: {
                                        ...draft,
                                        status: event.target.value as MembershipDraft["status"],
                                      },
                                    }))
                                  }
                                  className={selectClassName}
                                >
                                  {editableStatuses.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <button
                                type="button"
                                disabled={!changed || actingId === membership.id}
                                onClick={() => {
                                  if (!draft) {
                                    return;
                                  }

                                  const payload = {
                                    ...(draft.role !== membership.role
                                      ? { role: draft.role }
                                      : {}),
                                    ...(draft.status !== membership.status
                                      ? { status: draft.status }
                                      : {}),
                                  };

                                  setActingId(membership.id);
                                  setError(null);
                                  setSuccess(null);

                                  void withAccessTokenRetry((accessToken) =>
                                    updateMembershipRequest(
                                      accessToken,
                                      membership.id,
                                      payload,
                                    ),
                                  )
                                    .then((updated) => {
                                      setMemberships((current) =>
                                        current.map((item) =>
                                          item.id === updated.id ? updated : item,
                                        ),
                                      );
                                      setDrafts((current) => ({
                                        ...current,
                                        [updated.id]: {
                                          role: updated.role,
                                          status:
                                            updated.status === "DISABLED"
                                              ? "DISABLED"
                                              : "ACTIVE",
                                        },
                                      }));
                                      setSuccess(`Updated membership for ${updated.email}.`);
                                    })
                                    .catch((actionError) => {
                                      setError(
                                        actionError instanceof Error
                                          ? actionError.message
                                          : "Failed to update membership.",
                                      );
                                    })
                                    .finally(() => {
                                      setActingId(null);
                                    });
                                }}
                                className={`${subtleButtonClassName} w-full`}
                              >
                                {actingId === membership.id ? "Saving..." : "Save"}
                              </button>
                            </div>
                          ) : membership.status === "INVITED" ? (
                            <p className="mt-5 text-center text-sm text-slate-500">
                              Managed through invitations
                            </p>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Page {pagination.page} of {pagination.totalPages} | Total {pagination.total}
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pagination.page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className={subtleButtonClassName}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() =>
                      setPage((current) => Math.min(pagination.totalPages, current + 1))
                    }
                    className={subtleButtonClassName}
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>

            <div className="space-y-5">
              <SummaryCard
                eyebrow="Permissions"
                title="Role guidance"
                description="Keep access changes understandable as the team grows."
              >
                <div className="space-y-3 text-sm leading-6 text-slate-600">
                  <p>OWNER: full membership management and role changes.</p>
                  <p>MANAGER: review and operational visibility without owner elevation.</p>
                  <p>STAFF: no access to tenant-wide team management.</p>
                </div>
              </SummaryCard>

              <InvitationCreateCard />
            </div>
          </div>
        )}
      </AuthGuard>
    </AppShell>
  );
}
