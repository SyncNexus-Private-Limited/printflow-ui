"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type DashboardBranchOption = {
  label: string;
  value: string;
};

export type DashboardBranchControlState = {
  options: DashboardBranchOption[];
  value: string;
  disabled: boolean;
};

type DashboardChromeContextValue = {
  branchControl: DashboardBranchControlState | null;
  setBranchControl: (nextBranchControl: DashboardBranchControlState | null) => void;
};

const DashboardChromeContext = createContext<DashboardChromeContextValue | undefined>(undefined);

export function DashboardChromeProvider({ children }: { children: ReactNode }) {
  const [branchControl, setBranchControl] = useState<DashboardBranchControlState | null>(null);

  return (
    <DashboardChromeContext.Provider
      value={{
        branchControl,
        setBranchControl,
      }}
    >
      {children}
    </DashboardChromeContext.Provider>
  );
}

export function useDashboardChrome() {
  const context = useContext(DashboardChromeContext);

  if (!context) {
    throw new Error("useDashboardChrome must be used within DashboardChromeProvider");
  }

  return context;
}
