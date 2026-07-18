"use client";

import { useState } from "react";

export function useRemoteSearchPagination() {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  function applySearch() {
    setPage(1);
    setQuery(searchInput.trim());
  }

  return {
    page,
    query,
    searchInput,
    applySearch,
    setPage,
    setSearchInput,
  };
}
