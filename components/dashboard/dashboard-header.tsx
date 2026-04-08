import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { BranchFilter } from "@/components/dashboard/branch-filter";

type DashboardHeaderProps = {
  title: string;
  subtitle: string;
  branchOptions: Array<{
    label: string;
    value: string;
  }>;
  selectedBranchValue: string;
  branchFilterDisabled?: boolean;
  backHref?: string;
};

export function DashboardHeader({
  title,
  subtitle,
  branchOptions,
  selectedBranchValue,
  branchFilterDisabled = false,
  backHref,
}: DashboardHeaderProps) {
  return (
    <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        {backHref ? (
          <Link href={backHref} className="inline-flex text-sm font-medium text-slate-600 hover:text-slate-900">
            Back to dashboard
          </Link>
        ) : null}
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
          <p className="text-sm text-slate-600">{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <BranchFilter
          options={branchOptions}
          value={selectedBranchValue}
          disabled={branchFilterDisabled || branchOptions.length <= 1}
        />
        <LogoutButton />
      </div>
    </header>
  );
}
