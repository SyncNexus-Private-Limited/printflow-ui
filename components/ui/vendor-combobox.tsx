"use client";

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

export function VendorCombobox({ options, ...props }: VendorComboboxProps) {
  const optionsWithClear = [NO_VENDOR_OPTION, ...options];

  return (
    <Combobox
      {...props}
      options={optionsWithClear}
      getOptionLabel={(option) => option.name}
      placeholder="No vendor"
      searchPlaceholder="Search vendors…"
      searchAriaLabel="Search vendors"
      listAriaLabel="Vendors"
      emptyMessage="No vendors found."
    />
  );
}
