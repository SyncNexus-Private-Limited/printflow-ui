"use client";

import { Combobox } from "@/components/ui/combobox";
import type { ExpenseCategoryOption } from "@/lib/expenses/types";

type CategoryComboboxProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: ExpenseCategoryOption[];
  disabled?: boolean;
  placeholder?: string;
};

export function CategoryCombobox({
  placeholder = "Select a category",
  ...props
}: CategoryComboboxProps) {
  return (
    <Combobox
      {...props}
      placeholder={placeholder}
      getOptionLabel={(option) => option.name}
      getOptionDescription={(option) => option.description}
      searchPlaceholder="Search categories…"
      searchAriaLabel="Search categories"
      listAriaLabel="Categories"
      emptyMessage="No categories found."
    />
  );
}
