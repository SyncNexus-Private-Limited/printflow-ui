import type { ReactNode } from "react";
import { SessionHeartbeat } from "@/components/dashboard/session-heartbeat";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <>
      <SessionHeartbeat />
      {children}
    </>
  );
}

