import type { ReactNode } from "react";
import { SessionHeartbeat } from "@/components/dashboard/session-heartbeat";
import { TopNavbar } from "@/components/dashboard/top-navbar";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <>
      <SessionHeartbeat />
      <TopNavbar />
      {children}
    </>
  );
}

