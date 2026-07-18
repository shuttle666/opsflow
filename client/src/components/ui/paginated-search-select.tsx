"use client";

import { useMemo, useState } from "react";
import {
  inputClassName,
  selectClassName,
  subtleButtonClassName,
} from "@/components/ui/styles";
import type { PaginationMeta } from "@/types/customer";

export type PaginatedSearchSelectOption = {
  value: string;
  label: string;
  description?: string;
};

type PaginatedSearchSelectProps = {
  label: string;
  value: string;
  options: PaginatedSearchSelectOption[];
  selectedOption?: PaginatedSearchSelectOption | null;
  emptyLabel: string;
  searchPlaceholder: string;
  searchInput: string;
  pagination: PaginationMeta;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSearchInputChange: (value: string) => void;
  onSearch: () => void;
  onPageChange: (page: number) => void;
};

export function PaginatedSearchSelect({
  label,
  value,
  options,
  selectedOption,
  emptyLabel,
  searchPlaceholder,
  searchInput,
  pagination,
  loading = false,
  error,
  disabled = false,
  onChange,
  onSearchInputChange,
  onSearch,
  onPageChange,
}: PaginatedSearchSelectProps) {
  const [cachedSelection, setCachedSelection] =
    useState<PaginatedSearchSelectOption | null>(null);
  const currentOption = options.find((option) => option.value === value);
  const fallbackOption =
    selectedOption?.value === value
      ? selectedOption
      : cachedSelection?.value === value
        ? cachedSelection
        : null;
  const visibleOptions = useMemo(() => {
    if (!value || currentOption || !fallbackOption) {
      return options;
    }

    return [fallbackOption, ...options];
  }, [currentOption, fallbackOption, options, value]);
  const totalPages = Math.max(1, pagination.totalPages);

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-[var(--color-text-secondary)]">
        {label}
      </span>
      <div className="flex gap-2">
        <input
          type="search"
          aria-label={`${label} search`}
          value={searchInput}
          onChange={(event) => onSearchInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSearch();
            }
          }}
          placeholder={searchPlaceholder}
          disabled={disabled}
          className={inputClassName}
        />
        <button
          type="button"
          aria-label={`Search ${label}`}
          onClick={onSearch}
          disabled={disabled}
          className={subtleButtonClassName}
        >
          Search
        </button>
      </div>

      <select
        aria-label={label}
        value={value}
        disabled={disabled || loading}
        onChange={(event) => {
          const nextValue = event.target.value;
          const nextOption = visibleOptions.find(
            (option) => option.value === nextValue,
          );
          setCachedSelection(nextOption ?? null);
          onChange(nextValue);
        }}
        className={selectClassName}
      >
        <option value="">{emptyLabel}</option>
        {visibleOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.description
              ? `${option.label} (${option.description})`
              : option.label}
          </option>
        ))}
      </select>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
        <span aria-live="polite">
          {loading
            ? "Loading matches..."
            : `${pagination.total} match${pagination.total === 1 ? "" : "es"} · Page ${pagination.page} of ${totalPages}`}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label={`${label} previous results`}
            disabled={disabled || loading || pagination.page <= 1}
            onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
            className={`${subtleButtonClassName} px-2 text-xs`}
          >
            Previous
          </button>
          <button
            type="button"
            aria-label={`${label} next results`}
            disabled={disabled || loading || pagination.page >= totalPages}
            onClick={() =>
              onPageChange(Math.min(totalPages, pagination.page + 1))
            }
            className={`${subtleButtonClassName} px-2 text-xs`}
          >
            Next
          </button>
        </div>
      </div>
      {error ? (
        <p className="text-xs text-[var(--color-danger)]">{error}</p>
      ) : null}
    </div>
  );
}
