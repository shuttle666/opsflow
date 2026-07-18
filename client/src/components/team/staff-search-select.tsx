"use client";

import { PaginatedSearchSelect } from "@/components/ui/paginated-search-select";
import { useMembershipsQuery } from "@/features/membership/membership-queries";
import { useRemoteSearchPagination } from "@/hooks/use-remote-search-pagination";
import type { PaginationMeta } from "@/types/customer";
import type { MembershipListItem } from "@/types/membership";

const REMOTE_SELECT_PAGE_SIZE = 10;

type StaffSearchSelectProps = {
  value: string;
  valueKey?: "membershipId" | "userId";
  onChange: (value: string, membership?: MembershipListItem) => void;
  selectedMembership?: MembershipListItem | null;
  emptyLabel?: string;
  enabled?: boolean;
  label?: string;
};

export function StaffSearchSelect({
  value,
  valueKey = "membershipId",
  onChange,
  selectedMembership,
  emptyLabel = "Select staff member",
  enabled = true,
  label = "Assignee",
}: StaffSearchSelectProps) {
  const search = useRemoteSearchPagination();
  const membershipsQuery = useMembershipsQuery(
    {
      q: search.query || undefined,
      status: "ACTIVE",
      role: "STAFF",
      page: search.page,
      pageSize: REMOTE_SELECT_PAGE_SIZE,
    },
    enabled,
  );
  const memberships = membershipsQuery.data?.items ?? [];
  const pagination: PaginationMeta = membershipsQuery.data?.pagination ?? {
    page: search.page,
    pageSize: REMOTE_SELECT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  };
  const getValue = (membership: MembershipListItem) =>
    valueKey === "userId" ? membership.userId : membership.id;

  return (
    <PaginatedSearchSelect
      label={label}
      value={value}
      options={memberships.map((membership) => ({
        value: getValue(membership),
        label: membership.displayName,
        description: membership.email,
      }))}
      selectedOption={
        selectedMembership
          ? {
              value: getValue(selectedMembership),
              label: selectedMembership.displayName,
              description: selectedMembership.email,
            }
          : null
      }
      emptyLabel={emptyLabel}
      searchPlaceholder="Search staff by name or email"
      searchInput={search.searchInput}
      pagination={pagination}
      loading={membershipsQuery.isFetching}
      error={membershipsQuery.error ? "Failed to load staff options." : null}
      disabled={!enabled}
      onChange={(nextValue) => {
        onChange(
          nextValue,
          memberships.find(
            (membership) => getValue(membership) === nextValue,
          ),
        );
      }}
      onSearchInputChange={search.setSearchInput}
      onSearch={search.applySearch}
      onPageChange={search.setPage}
    />
  );
}
