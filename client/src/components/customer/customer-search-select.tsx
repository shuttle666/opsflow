"use client";

import Link from "next/link";
import { PaginatedSearchSelect } from "@/components/ui/paginated-search-select";
import { useCustomersQuery } from "@/features/customer/customer-queries";
import { useRemoteSearchPagination } from "@/hooks/use-remote-search-pagination";
import type { CustomerListItem, PaginationMeta } from "@/types/customer";

const REMOTE_SELECT_PAGE_SIZE = 10;

export type CustomerSelectOption = Pick<CustomerListItem, "id" | "name">;

type CustomerSearchSelectProps = {
  value: string;
  onChange: (customerId: string, customer?: CustomerListItem) => void;
  selectedCustomer?: CustomerSelectOption | null;
  emptyLabel?: string;
  enabled?: boolean;
  status?: "active" | "archived" | "all";
  showCreateCustomerAction?: boolean;
};

export function CustomerSearchSelect({
  value,
  onChange,
  selectedCustomer,
  emptyLabel = "Select customer",
  enabled = true,
  status = "active",
  showCreateCustomerAction = false,
}: CustomerSearchSelectProps) {
  const search = useRemoteSearchPagination();
  const customersQuery = useCustomersQuery(
    {
      q: search.query || undefined,
      page: search.page,
      pageSize: REMOTE_SELECT_PAGE_SIZE,
      status,
      sort: "name_asc",
    },
    { enabled },
  );
  const customers = customersQuery.data?.items ?? [];
  const pagination: PaginationMeta = customersQuery.data?.pagination ?? {
    page: search.page,
    pageSize: REMOTE_SELECT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  };

  return (
    <div className="space-y-2">
      <PaginatedSearchSelect
        label="Customer"
        value={value}
        options={customers.map((customer) => ({
          value: customer.id,
          label: customer.name,
        }))}
        selectedOption={
          selectedCustomer
            ? { value: selectedCustomer.id, label: selectedCustomer.name }
            : null
        }
        emptyLabel={emptyLabel}
        searchPlaceholder="Search customers by name, phone, or email"
        searchInput={search.searchInput}
        pagination={pagination}
        loading={customersQuery.isFetching}
        error={customersQuery.error ? "Failed to load customer options." : null}
        disabled={!enabled}
        onChange={(customerId) => {
          onChange(
            customerId,
            customers.find((customer) => customer.id === customerId),
          );
        }}
        onSearchInputChange={search.setSearchInput}
        onSearch={search.applySearch}
        onPageChange={search.setPage}
      />
      {showCreateCustomerAction &&
      customersQuery.isSuccess &&
      !value &&
      !search.query &&
      pagination.total === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">
          No customers are available yet.{" "}
          <Link
            href="/customers/new"
            className="font-semibold text-[var(--color-brand)] hover:underline"
          >
            Create a customer first
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
