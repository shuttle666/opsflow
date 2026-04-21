"use client";

import { useEffect, useMemo, useState } from "react";
import { InvitationCreateCard } from "@/components/auth/invitation-create-card";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/ui/app-shell";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { LoadingPanel } from "@/components/ui/loading-panel";
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
import {
  PAGINATED_LIST_BOTTOM_GAP,
  useAdaptivePageSize,
} from "@/hooks/use-adaptive-page-size";
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
const TEAM_CARD_ROW_HEIGHT_PX = 230;
const TEAM_GRID_ROW_GAP_PX = 12;
const TEAM_MIN_PAGE_SIZE = 1;

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

function membershipStatusColor(status: MembershipStatus) {
  switch (status) {
    case "ACTIVE":
      return "var(--color-success)";
    case "INVITED":
      return "var(--color-brand)";
    case "DISABLED":
      return "var(--color-danger)";
    default:
      return "var(--color-text-muted)";
  }
}

function getTeamGridItemsPerRow(itemArea: Element | null) {
  if (typeof window === "undefined") {
    return 1;
  }

  if (itemArea) {
    const gridTemplateColumns = window.getComputedStyle(itemArea).gridTemplateColumns;
    const computedColumns = gridTemplateColumns
      .split(" ")
      .filter((value) => value && value !== "none").length;

    if (computedColumns > 0) {
      return computedColumns;
    }
  }

  if (window.innerWidth >= 1536) {
    return 3;
  }

  if (window.innerWidth >= 768) {
    return 2;
  }

  return 1;
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
    pageSize: TEAM_MIN_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const allowReview = canReviewTeam(currentTenant?.role);
  const allowManage = canManageTeam(currentTenant?.role);
  const {
    containerRef: teamListAreaRef,
    hasMeasured: hasMeasuredPageSize,
    itemAreaRef: teamGridRef,
    pageSize: adaptivePageSize,
  } = useAdaptivePageSize<HTMLDivElement, HTMLElement>({
    bottomGap: PAGINATED_LIST_BOTTOM_GAP,
    itemHeight: TEAM_CARD_ROW_HEIGHT_PX,
    itemsPerRow: getTeamGridItemsPerRow,
    min: TEAM_MIN_PAGE_SIZE,
    minRows: 1,
    rowGap: TEAM_GRID_ROW_GAP_PX,
    dependencies: [error, isLoading, memberships.length, success],
  });
  const teamStats = useMemo(
    () => [
      { label: "Total", value: String(pagination.total || memberships.length), color: "var(--color-text)" },
      { label: "Active", value: String(memberships.filter((item) => item.status === "ACTIVE").length), color: "var(--color-success)" },
      { label: "Invited", value: String(memberships.filter((item) => item.status === "INVITED").length), color: "var(--color-brand)" },
      { label: "Disabled", value: String(memberships.filter((item) => item.status === "DISABLED").length), color: "var(--color-text-muted)" },
    ],
    [memberships, pagination.total],
  );

  useEffect(() => {
    if (!allowReview) {
      setMemberships([]);
      setIsLoading(false);
      return;
    }

    if (!hasMeasuredPageSize) {
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
            pageSize: adaptivePageSize,
          }),
        );

        if (!cancelled) {
          setMemberships(result.items);
          setPagination(result.pagination);
          setPage((current) =>
            current > result.pagination.totalPages
              ? result.pagination.totalPages
              : current,
          );
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
  }, [
    adaptivePageSize,
    allowReview,
    hasMeasuredPageSize,
    page,
    query,
    roleFilter,
    statusFilter,
    withAccessTokenRetry,
  ]);

  const roleOptions = useMemo<MembershipRole[]>(() => ["OWNER", "MANAGER", "STAFF"], []);

  return (
    <AppShell
      title="Team Members"
      actions={
        allowManage ? (
          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className={primaryButtonClassName}
          >
            Invite Member
          </button>
        ) : undefined
      }
    >
      <AuthGuard>
        {!allowReview ? (
          <EmptyStatePanel
            title="Team management is unavailable"
            description="Your current role cannot access team management in this tenant."
          />
        ) : (
          <div className="space-y-4">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {teamStats.map((stat) => (
                <div key={stat.label} className={`${surfaceClassName} p-4`}>
                  <p className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
                    {stat.label}
                  </p>
                  <p
                    className="mt-1 font-mono text-3xl font-bold leading-none"
                    style={{ color: stat.color }}
                  >
                    {stat.value}
                  </p>
                </div>
              ))}
            </section>

            <section className={`${surfaceClassName} p-3`}>
              <form
                className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_200px_200px_auto] xl:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  setPage(1);
                  setQuery(queryInput.trim());
                }}
              >
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Search</span>
                  <input
                    value={queryInput}
                    onChange={(event) => setQueryInput(event.target.value)}
                    placeholder="Search team members..."
                    className={inputClassName}
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Status</span>
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

                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Role</span>
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

                <button type="submit" className={primaryButtonClassName}>
                  Apply
                </button>
              </form>
            </section>

            <div className="space-y-3">
              {error ? <InlineErrorBanner message={error} /> : null}
              {success ? <p className="text-sm text-[var(--color-success)]">{success}</p> : null}

              <div ref={teamListAreaRef}>
                {isLoading ? (
                  <LoadingPanel label="Loading team members..." />
                ) : memberships.length === 0 ? (
                  <EmptyStatePanel
                    title="No team members found"
                    description="Adjust the current search or invite new people into this workspace."
                  />
                ) : (
                  <section
                    ref={teamGridRef}
                    className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3"
                  >
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
                      className={`${surfaceClassName} p-4 transition hover:border-[var(--color-brand)] hover:shadow-[var(--shadow-panel-hover)]`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--color-brand-soft)] bg-[var(--color-brand-soft)] text-sm font-bold text-[var(--color-brand)]">
                            {initialsFor(membership.displayName)}
                          </div>
                          <span
                            className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--color-app-panel)]"
                            style={{ background: membershipStatusColor(membership.status) }}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-[var(--color-text)]">
                            {membership.displayName}
                          </p>
                          <p className="truncate text-xs text-[var(--color-text-muted)]">
                            {membership.email}
                          </p>
                          <p className="mt-1 font-mono text-[10.5px] uppercase text-[var(--color-text-muted)]">
                            Joined {formatDate(membership.createdAt)}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <StatusBadge kind="role" value={membership.role} />
                          <StatusBadge kind="membership" value={membership.status} />
                        </div>
                      </div>

                      {canEdit ? (
                        <div className="mt-4 grid gap-3 border-t border-[var(--color-app-border)] pt-4 sm:grid-cols-2">
                          <label className="block space-y-1.5">
                            <span className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
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

                          <label className="block space-y-1.5">
                            <span className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
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
                            className={`${subtleButtonClassName} w-full sm:col-span-2`}
                          >
                            {actingId === membership.id ? "Saving..." : "Save"}
                          </button>
                        </div>
                      ) : membership.status === "INVITED" ? (
                        <p className="mt-4 border-t border-[var(--color-app-border)] pt-4 text-sm text-[var(--color-text-secondary)]">
                          Managed through invitations
                        </p>
                      ) : null}
                    </article>
                  );
                    })}
                  </section>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 text-sm text-[var(--color-text-secondary)] sm:flex-row sm:items-center sm:justify-between">
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

            {isInviteOpen ? (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Invite member"
                className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 px-4 py-8 backdrop-blur-sm"
              >
                <div className="w-full max-w-3xl space-y-3">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsInviteOpen(false)}
                      className={subtleButtonClassName}
                    >
                      Close
                    </button>
                  </div>
                  <InvitationCreateCard />
                </div>
              </div>
            ) : null}
          </div>
        )}
      </AuthGuard>
    </AppShell>
  );
}
