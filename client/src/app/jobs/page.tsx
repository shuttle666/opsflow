"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/ui/app-shell";
import { DataTableCard } from "@/components/ui/data-table-card";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { formatBadgeLabel, StatusBadge } from "@/components/ui/status-badge";
import { SummaryCard } from "@/components/ui/info-cards";
import {
  inputClassName,
  primaryButtonClassName,
  selectClassName,
  subtleButtonClassName,
} from "@/components/ui/styles";
import { listCustomersRequest } from "@/features/customer/customer-api";
import { formatDateTime, formatScheduleRange, listJobsRequest } from "@/features/job";
import {
  DEFAULT_ADAPTIVE_PAGE_SIZE_MIN,
  PAGINATED_LIST_BOTTOM_GAP,
  PAGINATED_TABLE_HEADER_OFFSET,
  useAdaptivePageSize,
} from "@/hooks/use-adaptive-page-size";
import { useAuthStore } from "@/store/auth-store";
import type { CustomerListItem, PaginationMeta } from "@/types/customer";
import type { JobListItem, JobStatus } from "@/types/job";

const JOB_ROW_HEIGHT_PX = 57;

const jobStatuses: Array<{ value: JobStatus; label: string }> = [
  { value: "NEW", label: formatBadgeLabel("NEW") },
  { value: "SCHEDULED", label: formatBadgeLabel("SCHEDULED") },
  { value: "IN_PROGRESS", label: formatBadgeLabel("IN_PROGRESS") },
  { value: "PENDING_REVIEW", label: formatBadgeLabel("PENDING_REVIEW") },
  { value: "COMPLETED", label: formatBadgeLabel("COMPLETED") },
  { value: "CANCELLED", label: formatBadgeLabel("CANCELLED") },
];

function canManageJobs(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

export default function JobsPage() {
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "">("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [sort, setSort] = useState<
    "createdAt_desc" | "createdAt_asc" | "scheduledStartAt_asc" | "scheduledStartAt_desc"
  >("createdAt_desc");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: DEFAULT_ADAPTIVE_PAGE_SIZE_MIN,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const allowManage = canManageJobs(currentTenant?.role);
  const {
    containerRef: jobTableAreaRef,
    hasMeasured: hasMeasuredPageSize,
    itemAreaRef: jobTableBodyRef,
    pageSize: adaptivePageSize,
  } = useAdaptivePageSize<HTMLDivElement, HTMLTableSectionElement>({
    bottomGap: PAGINATED_LIST_BOTTOM_GAP,
    itemHeight: JOB_ROW_HEIGHT_PX,
    topGap: PAGINATED_TABLE_HEADER_OFFSET,
    dependencies: [error, isLoading, jobs.length],
  });

  useEffect(() => {
    if (!allowManage) {
      setCustomers([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const result = await withAccessTokenRetry((accessToken) =>
          listCustomersRequest(accessToken, {
            page: 1,
            pageSize: 50,
            sort: "name_asc",
          }),
        );

        if (!cancelled) {
          setCustomers(result.items);
        }
      } catch {
        if (!cancelled) {
          setCustomers([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [allowManage, withAccessTokenRetry]);

  useEffect(() => {
    if (!allowManage) {
      setJobs([]);
      setPagination({
        page: 1,
        pageSize: DEFAULT_ADAPTIVE_PAGE_SIZE_MIN,
        total: 0,
        totalPages: 1,
      });
      setIsLoading(false);
      setError(null);
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
          listJobsRequest(accessToken, {
            q: query,
            status: statusFilter || undefined,
            customerId: customerFilter || undefined,
            page,
            pageSize: adaptivePageSize,
            sort,
          }),
        );

        if (!cancelled) {
          setJobs(result.items);
          setPagination(result.pagination);
          setPage((current) =>
            current > result.pagination.totalPages
              ? result.pagination.totalPages
              : current,
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Failed to load jobs.",
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
    allowManage,
    customerFilter,
    hasMeasuredPageSize,
    page,
    query,
    sort,
    statusFilter,
    withAccessTokenRetry,
  ]);

  return (
    <AppShell
      title="Jobs"
      actions={
        allowManage ? (
          <Link href="/jobs/new" className={primaryButtonClassName}>
            Create job
          </Link>
        ) : undefined
      }
    >
      <AuthGuard>
        {!allowManage ? (
          <SummaryCard
            eyebrow="Staff workspace"
            title="Open your assigned job queue"
            description="Staff members work from the personal jobs view instead of the tenant-wide operations list."
          >
            <div className="space-y-4 text-sm text-[var(--color-text-secondary)]">
              <Link
                href="/jobs/my"
                className={primaryButtonClassName}
              >
                Open my assigned jobs
              </Link>
            </div>
          </SummaryCard>
        ) : (
          <DataTableCard
            toolbar={
              <FilterToolbar>
                <form
                  className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_180px_220px_220px_auto]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setPage(1);
                    setQuery(queryInput.trim());
                  }}
                >
                  <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Search</span>
                  <input
                    value={queryInput}
                    onChange={(event) => setQueryInput(event.target.value)}
                    placeholder="Search jobs..."
                    className={inputClassName}
                  />
                </label>

                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Status</span>
                    <select
                      value={statusFilter}
                      onChange={(event) => {
                        setPage(1);
                        setStatusFilter((event.target.value as JobStatus | "") || "");
                      }}
                      className={selectClassName}
                    >
                      <option value="">All statuses</option>
                      {jobStatuses.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Customer</span>
                    <select
                      value={customerFilter}
                      onChange={(event) => {
                        setPage(1);
                        setCustomerFilter(event.target.value);
                      }}
                      className={selectClassName}
                    >
                      <option value="">All customers</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Sort</span>
                    <select
                      value={sort}
                      onChange={(event) => {
                        setPage(1);
                        setSort(
                          event.target.value as
                            | "createdAt_desc"
                            | "createdAt_asc"
                            | "scheduledStartAt_asc"
                            | "scheduledStartAt_desc",
                        );
                      }}
                      className={selectClassName}
                    >
                      <option value="createdAt_desc">Newest first</option>
                      <option value="createdAt_asc">Oldest first</option>
                      <option value="scheduledStartAt_asc">Scheduled earliest</option>
                      <option value="scheduledStartAt_desc">Scheduled latest</option>
                    </select>
                  </label>

                  <div className="flex items-end">
                    <button type="submit" className={primaryButtonClassName}>
                      Apply
                  </button>
                </div>
              </form>
              </FilterToolbar>
            }
            feedback={error ? <InlineErrorBanner message={error} /> : null}
            footer={
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
            }
          >
            <div ref={jobTableAreaRef}>
              {isLoading ? (
                <div className="p-4">
                  <LoadingPanel label="Loading jobs..." />
                </div>
              ) : jobs.length === 0 ? (
                <div className="p-4">
                  <EmptyStatePanel
                    title="No jobs found"
                    description="Try different filters or create a new work order for one of your customers."
                    actionLabel="Create job"
                    actionHref="/jobs/new"
                  />
                </div>
              ) : (
                <>
                <div className="divide-y divide-[var(--color-app-border)] md:hidden">
                  {jobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className="block px-4 py-4 transition hover:bg-[var(--color-app-panel-muted)]"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-bold text-[var(--color-text)]">
                              {job.title}
                            </p>
                            <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">
                              {job.customer.name}
                            </p>
                          </div>
                          <StatusBadge kind="job" value={job.status} />
                        </div>

                        <p className="truncate text-xs text-[var(--color-text-muted)]">
                          {job.serviceAddress}
                        </p>

                        <div className="grid gap-2 text-xs text-[var(--color-text-secondary)]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold uppercase text-[var(--color-text-muted)]">
                              Scheduled
                            </span>
                            <span className="min-w-0 truncate text-right font-mono">
                              {formatScheduleRange(job.scheduledStartAt, job.scheduledEndAt)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold uppercase text-[var(--color-text-muted)]">
                              Assigned
                            </span>
                            <span className="min-w-0 truncate text-right">
                              {job.assignedToName ?? "-"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold uppercase text-[var(--color-text-muted)]">
                              Updated
                            </span>
                            <span className="min-w-0 truncate text-right font-mono">
                              {formatDateTime(job.updatedAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="border-b border-[var(--color-app-border)] text-left text-[11px] uppercase text-[var(--color-text-muted)]">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Title</th>
                        <th className="px-4 py-2.5 font-semibold">Customer</th>
                        <th className="px-4 py-2.5 font-semibold">Service address</th>
                        <th className="px-4 py-2.5 font-semibold">Status</th>
                        <th className="px-4 py-2.5 font-semibold">Scheduled</th>
                        <th className="px-4 py-2.5 font-semibold">Assigned</th>
                        <th className="px-4 py-2.5 font-semibold">Updated</th>
                      </tr>
                    </thead>
                    <tbody
                      ref={jobTableBodyRef}
                      className="divide-y divide-[var(--color-app-border)] text-[var(--color-text-secondary)]"
                    >
                      {jobs.map((job) => (
                        <tr
                          key={job.id}
                          className="group transition hover:bg-[var(--color-app-panel-muted)]"
                        >
                          <td className="px-4 py-3 font-semibold text-[var(--color-text)]">
                            <Link
                              href={`/jobs/${job.id}`}
                              className="transition hover:text-[var(--color-brand)]"
                            >
                              {job.title}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            {job.customer.name}
                          </td>
                          <td className="max-w-[240px] truncate px-4 py-3">
                            {job.serviceAddress}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge kind="job" value={job.status} />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {formatScheduleRange(job.scheduledStartAt, job.scheduledEndAt)}
                          </td>
                          <td className="px-4 py-3">
                            {job.assignedToName ?? "-"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {formatDateTime(job.updatedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </div>
          </DataTableCard>
        )}
      </AuthGuard>
    </AppShell>
  );
}
