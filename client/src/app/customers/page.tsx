"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/ui/app-shell";
import { DataTableCard } from "@/components/ui/data-table-card";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { MoreHorizontal } from "@/components/ui/icons";
import {
  cn,
  inputClassName,
  primaryButtonClassName,
  badgeBaseClassName,
  selectClassName,
  subtleButtonClassName,
} from "@/components/ui/styles";
import { listCustomersRequest } from "@/features/customer/customer-api";
import { useAuthStore } from "@/store/auth-store";
import type { CustomerListItem, PaginationMeta } from "@/types/customer";

function canManageCustomers(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

const avatarColors = [
  "bg-sky-100 text-sky-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
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
            Add Customer
          </Link>
        ) : undefined
      }
    >
      <AuthGuard>
        <DataTableCard
          toolbar={
            <div className="flex flex-wrap items-center gap-3">
              <form
                className="flex items-center gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  setPage(1);
                  setQuery(queryInput.trim());
                }}
              >
                <input
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder="Search customers..."
                  className={`${inputClassName} w-[260px]`}
                />
              </form>
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
            </div>
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
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="border-b border-[var(--color-app-border)] text-left text-[11px] uppercase text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Name</th>
                    <th className="px-4 py-2.5 font-semibold">Email</th>
                    <th className="px-4 py-2.5 font-semibold">Phone</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-app-border)] text-[var(--color-text-secondary)]">
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="group transition hover:bg-[var(--color-app-panel-muted)]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="flex items-center gap-3 transition hover:text-[var(--color-brand)]"
                        >
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
                              avatarColor(customer.name),
                            )}
                          >
                            {initialsFor(customer.name)}
                          </div>
                          <span className="font-semibold text-[var(--color-text)]">{customer.name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {customer.email ?? "-"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {customer.phone ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(badgeBaseClassName, "border-[var(--color-app-border)] bg-[var(--color-success-soft)] text-[var(--color-success)]")}>
                          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                          Active
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition hover:bg-[var(--color-app-panel-muted)] hover:text-[var(--color-text)]"
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </Link>
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
