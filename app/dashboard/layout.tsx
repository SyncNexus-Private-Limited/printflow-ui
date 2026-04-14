import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SessionHeartbeat } from "@/components/dashboard/session-heartbeat";
import { getCurrentUser } from "@/lib/auth/current-user";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const currentUserPromise = getCurrentUser();

  return (
    <>
      <SessionHeartbeat />
      <DashboardShellWrapper currentUserPromise={currentUserPromise}>{children}</DashboardShellWrapper>
    </>
  );
}

async function DashboardShellWrapper({
  children,
  currentUserPromise,
}: {
  children: ReactNode;
  currentUserPromise: ReturnType<typeof getCurrentUser>;
}) {
  const currentUser = await currentUserPromise;

  return (
    <DashboardShell
      initialBranchId={currentUser?.branchId ?? null}
      initialBranchName={currentUser?.branchName ?? null}
      canSelectAllBranches={currentUser?.role === "admin"}
    >
      {children}
    </DashboardShell>
  );
}
