"use client";

import { useEffect, useRef, useState } from "react";
import { Combobox } from "@/components/ui/combobox";
import type { ExpenseVendorOption } from "@/lib/expenses/types";

type VendorComboboxProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: ExpenseVendorOption[];
  disabled?: boolean;
};

const NO_VENDOR_OPTION: ExpenseVendorOption = { id: "", name: "No vendor" };
const SEARCH_DEBOUNCE_MS = 300;

export function VendorCombobox({ options, ...props }: VendorComboboxProps) {
  const [searchResults, setSearchResults] = useState<ExpenseVendorOption[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    },
    [],
  );

  function handleQueryChange(query: string) {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = query.trim();

    if (!q) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimerRef.current = setTimeout(() => {
      fetch(`/api/vendors/search?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((data: { success: boolean; data: ExpenseVendorOption[] }) => {
          if (data.success) setSearchResults(data.data);
        })
        .catch(() => {})
        .finally(() => setIsSearching(false));
    }, SEARCH_DEBOUNCE_MS);
  }

  const displayedOptions = [NO_VENDOR_OPTION, ...(searchResults ?? options)];

  return (
    <Combobox
      {...props}
      options={displayedOptions}
      disableLocalFilter
      onQueryChange={handleQueryChange}
      isLoading={isSearching}
      loadingMessage="Searching vendors…"
      getOptionLabel={(option) => option.name}
      placeholder="No vendor"
      searchPlaceholder="Search vendors…"
      searchAriaLabel="Search vendors"
      listAriaLabel="Vendors"
      emptyMessage="No vendors found."
    />
  );
}
