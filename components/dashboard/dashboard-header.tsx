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
    <header className="rounded-[28px] border border-[rgb(var(--border))] bg-[linear-gradient(135deg,rgb(var(--card))_0%,rgb(var(--primary-soft))_120%)] p-6 shadow-[0_24px_70px_-42px_rgb(var(--shadow)/0.4)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--card)/0.88)] px-3 py-1 text-sm font-medium text-[rgb(var(--muted-foreground))] transition-colors hover:text-[rgb(var(--foreground))]"
            >
              Back to dashboard
            </Link>
          ) : null}
          <div className="space-y-3">
            <span className="inline-flex rounded-full bg-[rgb(var(--primary-soft))] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[rgb(var(--primary-soft-foreground))]">
              Business control panel
            </span>
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold tracking-tight text-[rgb(var(--card-foreground))]">{title}</h1>
              <p className="text-sm text-[rgb(var(--muted-foreground))]">{subtitle}</p>
            </div>
          </div>
          <p className="text-xs text-[rgb(var(--muted-foreground))]">Theme shortcut: Ctrl/Cmd + J</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <BranchFilter
            options={branchOptions}
            value={selectedBranchValue}
            disabled={branchFilterDisabled || branchOptions.length <= 1}
          />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
