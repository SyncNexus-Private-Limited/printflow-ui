import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SessionHeartbeat } from "@/components/dashboard/session-heartbeat";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <>
      <SessionHeartbeat />
      <DashboardShell>{children}</DashboardShell>
    </>
  );
}
