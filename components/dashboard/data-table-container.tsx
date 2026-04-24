import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type DataTableContainerProps = {
  children: ReactNode;
  className?: string;
};

export function DataTableContainer({ children, className }: DataTableContainerProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border border-[rgb(var(--border)/0.78)] bg-[rgb(var(--card)/0.92)] backdrop-blur-lg",
        className,
      )}
    >
      {children}
    </div>
  );
}
