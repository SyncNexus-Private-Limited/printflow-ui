import { cn } from "@/lib/utils/cn";

type RouteLoadingProps = {
  message?: string;
  fullHeight?: boolean;
  className?: string;
};

export function RouteLoading({
  message = "Loading content...",
  fullHeight = false,
  className,
}: RouteLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "flex items-center justify-center px-4 py-8",
        fullHeight && "min-h-screen",
        className,
      )}
    >
      <div className="w-full max-w-xl rounded-[28px] border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--card)/0.94)] p-6 shadow-[0_22px_52px_-44px_rgb(var(--shadow)/0.18)] backdrop-blur-lg sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgb(var(--primary-soft))]">
            <div className="flex items-center gap-1" aria-hidden="true">
              <span className="h-2 w-2 animate-bounce rounded-full bg-[rgb(var(--primary-soft-foreground))] [animation-delay:-0.2s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-[rgb(var(--primary-soft-foreground))] [animation-delay:-0.1s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-[rgb(var(--primary-soft-foreground))]" />
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-base font-semibold text-[rgb(var(--card-foreground))]">{message}</p>
            <p className="text-sm text-[rgb(var(--muted-foreground))]">Please wait while the next view is prepared.</p>

            <div className="space-y-2.5" aria-hidden="true">
              <div className="h-3 w-5/6 animate-pulse rounded-full bg-[rgb(var(--muted))]" />
              <div className="h-3 w-2/3 animate-pulse rounded-full bg-[rgb(var(--muted))]" />
              <div className="h-3 w-3/4 animate-pulse rounded-full bg-[rgb(var(--muted))]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
