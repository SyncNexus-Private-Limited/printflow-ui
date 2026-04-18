"use client";

import { useTransition } from "react";
import { ChevronsUpDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";

type BranchFilterOption = {
  label: string;
  value: string;
};

type BranchFilterProps = {
  options: BranchFilterOption[];
  value: string;
  disabled?: boolean;
  className?: string;
  selectClassName?: string;
  hideLabel?: boolean;
  id?: string;
  placeholderLabel?: string;
};

export function BranchFilter({
  options,
  value,
  disabled = false,
  className,
  selectClassName,
  hideLabel = false,
  id = "branch-filter",
  placeholderLabel = "All branches",
}: BranchFilterProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const isDisabled = disabled || isPending;
  const selectedOption = options.find((option) => option.value === value);
  const resolvedValue = selectedOption ? value : "__branch-placeholder__";
  const selectedLabel = selectedOption?.label ?? placeholderLabel;

  return (
    <div className={cn("w-full min-w-0", className)}>
      <label
        className={cn("mb-2 block text-sm font-medium text-[rgb(var(--foreground))]", hideLabel && "sr-only mb-0")}
        htmlFor={id}
      >
        Branch
      </label>
      <div className="relative">
        <Select
          className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
          id={id}
          value={resolvedValue}
          disabled={isDisabled}
          title={selectedLabel}
          aria-label={selectedLabel}
          onChange={(event) => {
            const nextSearchParams = new URLSearchParams(searchParams.toString());
            nextSearchParams.set("branchId", event.target.value);

            startTransition(() => {
              router.replace(`${pathname}?${nextSearchParams.toString()}`);
            });
          }}
        >
          {!selectedOption ? (
            <option value={resolvedValue}>
              {selectedLabel}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <div
          aria-hidden="true"
          className={cn(
            "flex h-10 items-center gap-3 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--background))] px-3.5 pr-10 shadow-[0_16px_40px_-34px_rgb(var(--shadow)/0.18)] transition-colors",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-[rgb(var(--primary)/0.35)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-transparent",
            !isDisabled && "peer-hover:border-[rgb(var(--border)/1)] peer-hover:bg-[rgb(var(--card))]",
            isDisabled && "opacity-60",
            selectClassName,
          )}
          title={selectedLabel}
        >
          <span className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted-foreground))] sm:inline">
            Branch
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[rgb(var(--foreground))]">{selectedLabel}</span>
        </div>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[rgb(var(--muted-foreground))]">
          <ChevronsUpDown className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
        </span>
      </div>
    </div>
  );
}
