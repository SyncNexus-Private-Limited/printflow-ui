import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SessionHeartbeat } from "@/components/dashboard/session-heartbeat";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const currentUserPromise = getCurrentUser();

  return (
    <>
      <SessionHeartbeat />
      <DashboardShellWrapper currentUserPromise={currentUserPromise}>
        {children}
      </DashboardShellWrapper>
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

  // Session revoked or user locked: JWT is still valid so middleware won't
  // clear the cookie, causing a /dashboard ↔ /login redirect loop.
  // Route through /api/auth/clear to strip the cookie first.
  if (!currentUser) {
    redirect("/api/auth/clear");
  }

  return (
    <DashboardShell
      initialBranchId={currentUser.branchId ?? null}
      initialBranchName={currentUser.branchName ?? null}
      canSelectAllBranches={hasPermission(currentUser, "branches:select_all")}
      canManageUsers={hasPermission(currentUser, "users:view")}
      canViewExpenseCategories={hasPermission(currentUser, "expense-categories:view")}
      canCreateInventory={hasPermission(currentUser, "inventory:create")}
      canCreateExpense={hasPermission(currentUser, "expenses:create")}
      canCreateUser={hasPermission(currentUser, "users:create")}
    >
      {children}
    </DashboardShell>
  );
}
