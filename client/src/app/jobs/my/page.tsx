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
import { StatusBadge } from "@/components/ui/status-badge";
import {
  inputClassName,
  primaryButtonClassName,
  selectClassName,
  subtleButtonClassName,
} from "@/components/ui/styles";
import { formatDateTime, formatScheduleRange, listMyJobsRequest } from "@/features/job";
import { useAuthStore } from "@/store/auth-store";
import type { PaginationMeta } from "@/types/customer";
import type { JobListItem, JobStatus } from "@/types/job";

const jobStatuses: Array<{ value: JobStatus; label: string }> = [
  { value: "NEW", label: "NEW" },
  { value: "SCHEDULED", label: "SCHEDULED" },
  { value: "IN_PROGRESS", label: "IN_PROGRESS" },
  { value: "COMPLETED", label: "COMPLETED" },
  { value: "CANCELLED", label: "CANCELLED" },
];

export default function MyJobsPage() {
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "">("");
  const [sort, setSort] = useState<
    "createdAt_desc" | "createdAt_asc" | "scheduledStartAt_asc" | "scheduledStartAt_desc"
  >("createdAt_desc");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await withAccessTokenRetry((accessToken) =>
          listMyJobsRequest(accessToken, {
            q: query,
            status: statusFilter || undefined,
            page,
            pageSize: 10,
            sort,
          }),
        );

        if (!cancelled) {
          setJobs(result.items);
          setPagination(result.pagination);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load assigned jobs.",
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
  }, [page, query, sort, statusFilter, withAccessTokenRetry]);

  return (
    <AppShell
      title="My Jobs"
    >
      <AuthGuard>
        <DataTableCard
          toolbar={
            <FilterToolbar>
              <form
                className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_220px_220px_auto]"
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
                    placeholder="Search my jobs..."
                    className={inputClassName}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Status</span>
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
                  <span className="text-sm font-medium text-slate-700">Sort</span>
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
            <div className="flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
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
          {isLoading ? (
            <div className="p-4">
              <LoadingPanel label="Loading assigned jobs..." />
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-4">
              <EmptyStatePanel
                title="No assigned jobs"
                description="When a manager assigns work to this account, those jobs will appear in this personal queue."
              />
            </div>
          ) : (
            <div className="overflow-x-auto px-3 pb-3">
              <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                <thead className="text-left text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Title</th>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Scheduled</th>
                    <th className="px-4 py-3 font-semibold">Updated</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      className="group rounded-[24px] bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50"
                    >
                      <td className="rounded-l-[24px] border-y border-l border-white px-4 py-4 font-medium text-slate-900 group-hover:border-sky-100">
                        <Link href={`/jobs/${job.id}`} className="hover:text-cyan-700">
                          {job.title}
                        </Link>
                      </td>
                      <td className="border-y border-white px-4 py-4 group-hover:border-sky-100">
                        {job.customer.name}
                      </td>
                      <td className="border-y border-white px-4 py-4 group-hover:border-sky-100">
                        <StatusBadge kind="job" value={job.status} />
                      </td>
                      <td className="border-y border-white px-4 py-4 group-hover:border-sky-100">
                        {formatScheduleRange(job.scheduledStartAt, job.scheduledEndAt)}
                      </td>
                      <td className="rounded-r-[24px] border-y border-r border-white px-4 py-4 group-hover:border-sky-100">
                        {formatDateTime(job.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataTableCard>
      </AuthGuard>
    </AppShell>
  );
}
