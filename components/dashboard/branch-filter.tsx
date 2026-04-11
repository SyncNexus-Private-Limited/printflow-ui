"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import { useGlobalLoader } from "@/lib/ui/global-loader-context";

type BranchFilterOption = {
  label: string;
  value: string;
};

type BranchFilterProps = {
  options: BranchFilterOption[];
  value: string;
  disabled?: boolean;
};

export function BranchFilter({ options, value, disabled = false }: BranchFilterProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showBlockingLoader } = useGlobalLoader();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="w-full sm:w-72">
      <label className="mb-2 block text-sm font-medium text-[rgb(var(--foreground))]" htmlFor="branch-filter">
        Branch
      </label>
      <Select
        className="bg-[rgb(var(--card)/0.92)]"
        id="branch-filter"
        value={value}
        disabled={disabled || isPending}
        onChange={(event) => {
          const nextSearchParams = new URLSearchParams(searchParams.toString());
          nextSearchParams.set("branchId", event.target.value);
          showBlockingLoader("Updating branch...", {
            autoHideOnRouteChange: true,
          });

          startTransition(() => {
            router.replace(`${pathname}?${nextSearchParams.toString()}`);
          });
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
