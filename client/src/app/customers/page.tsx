"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/ui/app-shell";
import { DataTableCard } from "@/components/ui/data-table-card";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { LoadingPanel } from "@/components/ui/loading-panel";
import { MoreHorizontal, Search } from "@/components/ui/icons";
import {
  cn,
  inputClassName,
  primaryButtonClassName,
  badgeBaseClassName,
  subtleButtonClassName,
} from "@/components/ui/styles";
import { listCustomersRequest } from "@/features/customer/customer-api";
import {
  DEFAULT_ADAPTIVE_PAGE_SIZE_MIN,
  PAGINATED_LIST_BOTTOM_GAP,
  PAGINATED_TABLE_HEADER_OFFSET,
  useAdaptivePageSize,
} from "@/hooks/use-adaptive-page-size";
import { useAuthStore } from "@/store/auth-store";
import type { CustomerListItem, PaginationMeta } from "@/types/customer";

type ContactFilter = "all" | "has_contact" | "missing_contact";
type CustomerStatusFilter = "active" | "archived" | "all";

const toolbarSelectClassName =
  "h-9 w-full rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-panel)] px-3 pr-8 text-[13px] text-[var(--color-text)] shadow-sm outline-none transition focus:border-[var(--color-brand)] focus:ring-[3px] focus:ring-[var(--color-brand-soft)] sm:w-[160px]";

const CUSTOMER_ROW_HEIGHT_PX = 57;

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
  "bg-[var(--color-brand-soft)] text-[var(--color-brand)]",
  "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  "bg-[var(--color-brand-surface)] text-[var(--color-brand)]",
  "bg-[var(--color-app-panel-muted)] text-[var(--color-text-secondary)]",
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
  const [contactFilter, setContactFilter] = useState<ContactFilter>("all");
  const [statusFilter, setStatusFilter] = useState<CustomerStatusFilter>("active");
  const [sort, setSort] = useState<
    "createdAt_desc" | "createdAt_asc" | "name_asc" | "name_desc"
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

  const allowManage = canManageCustomers(currentTenant?.role);
  const visibleCustomers = useMemo(() => {
    if (contactFilter === "has_contact") {
      return customers.filter((customer) => customer.phone || customer.email);
    }

    if (contactFilter === "missing_contact") {
      return customers.filter((customer) => !customer.phone && !customer.email);
    }

    return customers;
  }, [contactFilter, customers]);

  const {
    containerRef: customerTableAreaRef,
    hasMeasured: hasMeasuredPageSize,
    itemAreaRef: customerTableBodyRef,
    pageSize: adaptivePageSize,
  } = useAdaptivePageSize<HTMLDivElement, HTMLTableSectionElement>({
    bottomGap: PAGINATED_LIST_BOTTOM_GAP,
    itemHeight: CUSTOMER_ROW_HEIGHT_PX,
    topGap: PAGINATED_TABLE_HEADER_OFFSET,
    dependencies: [error, isLoading, visibleCustomers.length],
  });

  useEffect(() => {
    if (!hasMeasuredPageSize) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await withAccessTokenRetry((accessToken) =>
          listCustomersRequest(accessToken, {
            q: query,
            page,
            pageSize: adaptivePageSize,
            status: statusFilter,
            sort,
          }),
        );

        if (!cancelled) {
          setCustomers(result.items);
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
  }, [
    adaptivePageSize,
    hasMeasuredPageSize,
    page,
    query,
    sort,
    statusFilter,
    withAccessTokenRetry,
  ]);

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
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <form
                className="relative w-full lg:w-[260px]"
                onSubmit={(event) => {
                  event.preventDefault();
                  setPage(1);
                  setQuery(queryInput.trim());
                }}
              >
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder="Search customers..."
                  className={`${inputClassName} !pl-9`}
                />
              </form>
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  aria-label="Contact filter"
                  value={contactFilter}
                  onChange={(event) => {
                    setPage(1);
                    setContactFilter(event.target.value as ContactFilter);
                  }}
                  className={toolbarSelectClassName}
                >
                  <option value="all">All contacts</option>
                  <option value="has_contact">Has contact</option>
                  <option value="missing_contact">Missing contact</option>
                </select>
                <select
                  aria-label="Customer status"
                  value={statusFilter}
                  onChange={(event) => {
                    setPage(1);
                    setStatusFilter(event.target.value as CustomerStatusFilter);
                  }}
                  className={toolbarSelectClassName}
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                  <option value="all">All statuses</option>
                </select>
                <select
                  aria-label="Sort customers"
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
                  className={toolbarSelectClassName}
                >
                  <option value="createdAt_desc">Newest first</option>
                  <option value="createdAt_asc">Oldest first</option>
                  <option value="name_asc">Name A-Z</option>
                  <option value="name_desc">Name Z-A</option>
                </select>
                <span className="text-xs font-medium text-[var(--color-text-muted)] sm:ml-auto">
                  {visibleCustomers.length} customers
                </span>
              </div>
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
          <div ref={customerTableAreaRef}>
            {isLoading ? (
              <div className="p-4">
                <LoadingPanel label="Loading customers..." />
              </div>
            ) : visibleCustomers.length === 0 ? (
              <div className="p-4">
                <EmptyStatePanel
                  title={customers.length === 0 ? "No customers found" : "No customers match this filter"}
                  description={
                    customers.length === 0
                      ? statusFilter === "archived"
                        ? "No archived customers match the current search."
                        : "Adjust the current search or create the first customer profile for this tenant."
                      : "Try a different contact filter or adjust the current search."
                  }
                  actionLabel={
                    customers.length === 0 && allowManage && statusFilter !== "archived"
                      ? "Create customer"
                      : undefined
                  }
                  actionHref={
                    customers.length === 0 && allowManage && statusFilter !== "archived"
                      ? "/customers/new"
                      : undefined
                  }
                />
              </div>
            ) : (
              <>
              <div className="divide-y divide-[var(--color-app-border)] md:hidden">
                {visibleCustomers.map((customer) => (
                  <Link
                    key={customer.id}
                    href={`/customers/${customer.id}`}
                    className="block px-4 py-4 transition hover:bg-[var(--color-app-panel-muted)]"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
                          avatarColor(customer.name),
                        )}
                      >
                        {initialsFor(customer.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[var(--color-text)]">
                              {customer.name}
                            </p>
                            <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">
                              {customer.email ?? "No email on file"}
                            </p>
                          </div>
                          <span
                            className={cn(
                              badgeBaseClassName,
                              "shrink-0",
                              customer.archivedAt
                                ? "border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] text-[var(--color-text-secondary)]"
                                : "border-[var(--color-app-border)] bg-[var(--color-success-soft)] text-[var(--color-success)]",
                            )}
                          >
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                            {customer.archivedAt ? "Archived" : "Active"}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--color-text-muted)]">
                          <span className="truncate font-mono">
                            {customer.phone ?? "No phone"}
                          </span>
                          <MoreHorizontal className="h-5 w-5 shrink-0" />
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
                      <th className="px-4 py-2.5 font-semibold">Name</th>
                      <th className="px-4 py-2.5 font-semibold">Email</th>
                      <th className="px-4 py-2.5 font-semibold">Phone</th>
                      <th className="px-4 py-2.5 font-semibold">Status</th>
                      <th className="px-4 py-2.5 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody
                    ref={customerTableBodyRef}
                    className="divide-y divide-[var(--color-app-border)] text-[var(--color-text-secondary)]"
                  >
                    {visibleCustomers.map((customer) => (
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
                          <span
                            className={cn(
                              badgeBaseClassName,
                              customer.archivedAt
                                ? "border-[var(--color-app-border)] bg-[var(--color-app-panel-muted)] text-[var(--color-text-secondary)]"
                                : "border-[var(--color-app-border)] bg-[var(--color-success-soft)] text-[var(--color-success)]",
                            )}
                          >
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                            {customer.archivedAt ? "Archived" : "Active"}
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
              </>
            )}
          </div>
        </DataTableCard>
      </AuthGuard>
    </AppShell>
  );
}
