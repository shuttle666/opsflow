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
import {
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  selectClassName,
  subtleButtonClassName,
} from "@/components/ui/styles";
import { listCustomersRequest } from "@/features/customer/customer-api";
import { useAuthStore } from "@/store/auth-store";
import type { CustomerListItem, PaginationMeta } from "@/types/customer";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function canManageCustomers(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

export default function CustomersPage() {
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<
    "createdAt_desc" | "createdAt_asc" | "name_asc" | "name_desc"
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
          listCustomersRequest(accessToken, {
            q: query,
            page,
            pageSize: 10,
            sort,
          }),
        );

        if (!cancelled) {
          setCustomers(result.items);
          setPagination(result.pagination);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load customers.",
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
  }, [page, query, sort, withAccessTokenRetry]);

  const allowManage = canManageCustomers(currentTenant?.role);

  return (
    <AppShell
      title="Customers"
      actions={
        allowManage ? (
          <Link href="/customers/new" className={primaryButtonClassName}>
            Create customer
          </Link>
        ) : undefined
      }
    >
      <AuthGuard>
        <DataTableCard
          toolbar={
            <FilterToolbar>
              <form
                className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_220px_auto]"
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
                    placeholder="Search customers..."
                    className={inputClassName}
                  />
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
                          | "name_asc"
                          | "name_desc",
                      );
                    }}
                    className={selectClassName}
                  >
                    <option value="createdAt_desc">Newest first</option>
                    <option value="createdAt_asc">Oldest first</option>
                    <option value="name_asc">Name A-Z</option>
                    <option value="name_desc">Name Z-A</option>
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
              <LoadingPanel label="Loading customers..." />
            </div>
          ) : customers.length === 0 ? (
            <div className="p-4">
              <EmptyStatePanel
                title="No customers found"
                description="Adjust the current search or create the first customer profile for this tenant."
                actionLabel={allowManage ? "Create customer" : undefined}
                actionHref={allowManage ? "/customers/new" : undefined}
              />
            </div>
          ) : (
            <div className="overflow-x-auto px-3 pb-3">
              <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                <thead className="text-left text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Phone</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Address</th>
                    <th className="px-4 py-3 font-semibold">Updated</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="group rounded-[24px] bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50"
                    >
                      <td className="rounded-l-[24px] border-y border-l border-white px-4 py-4 font-medium text-slate-900 group-hover:border-sky-100">
                        <Link href={`/customers/${customer.id}`} className="hover:text-cyan-700">
                          {customer.name}
                        </Link>
                      </td>
                      <td className="border-y border-white px-4 py-4 group-hover:border-sky-100">
                        {customer.phone ?? "-"}
                      </td>
                      <td className="border-y border-white px-4 py-4 group-hover:border-sky-100">
                        {customer.email ?? "-"}
                      </td>
                      <td className="border-y border-white px-4 py-4 group-hover:border-sky-100">
                        {customer.address ?? "-"}
                      </td>
                      <td className="rounded-r-[24px] border-y border-r border-white px-4 py-4 group-hover:border-sky-100">
                        {formatDate(customer.updatedAt)}
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
