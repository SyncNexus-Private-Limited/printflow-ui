"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useToast, type Toast, type ToastVariant } from "@/lib/ui/toast-context";
import { cn } from "@/lib/utils/cn";

const VARIANT_ICONS: Record<ToastVariant, typeof Info> = {
  info: Info,
  error: AlertCircle,
  success: CheckCircle2,
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = VARIANT_ICONS[toast.variant];

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex w-full max-w-sm items-start gap-3 rounded-2xl px-4 py-3",
        "border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--card)/0.96)] backdrop-blur-[14px]",
        "shadow-[0_20px_44px_-32px_rgb(var(--shadow)/0.22)]",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          toast.variant === "error" && "text-red-500",
          toast.variant === "success" && "text-emerald-500",
          toast.variant === "info" && "text-[rgb(var(--muted-foreground))]",
        )}
        strokeWidth={1.9}
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 text-sm leading-snug text-[rgb(var(--card-foreground))]">
        {toast.message}
      </p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded-lg p-0.5 text-[rgb(var(--muted-foreground))] transition-colors hover:bg-[rgb(var(--muted)/0.74)] hover:text-[rgb(var(--foreground))]"
        aria-label="Dismiss notification"
        title="Dismiss"
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.9} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed right-4 bottom-4 z-100 flex flex-col items-end gap-2"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}
