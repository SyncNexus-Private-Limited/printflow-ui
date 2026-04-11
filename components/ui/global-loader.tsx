"use client";

import { useGlobalLoader } from "@/lib/ui/global-loader-context";

export function GlobalLoader() {
  const { blockingLoader, nonBlockingLoader } = useGlobalLoader();

  return (
    <>
      {nonBlockingLoader ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-1 overflow-hidden bg-[rgb(var(--border)/0.18)]">
          <span className="sr-only" role="status" aria-live="polite">
            {nonBlockingLoader.message}
          </span>
          <div className="h-full w-1/3 rounded-full bg-[linear-gradient(90deg,rgb(var(--primary-soft-foreground))_0%,rgb(var(--primary))_50%,rgb(var(--primary-strong))_100%)] shadow-[0_0_18px_rgb(var(--primary)/0.42)] animate-[global-loader-marquee_1.15s_ease-in-out_infinite]" />
        </div>
      ) : null}

      {blockingLoader ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgb(var(--background)/0.62)] px-4 backdrop-blur-md"
          aria-busy="true"
          aria-live="polite"
        >
          <div
            className="flex w-full max-w-sm items-center gap-4 rounded-[28px] border border-[rgb(var(--border))] bg-[linear-gradient(180deg,rgb(var(--card)/0.98)_0%,rgb(var(--primary-soft)/0.92)_140%)] px-6 py-5 shadow-[0_32px_90px_-54px_rgb(var(--shadow)/0.55)]"
            role="status"
          >
            <div className="relative h-12 w-12 shrink-0">
              <div className="absolute inset-0 rounded-full border-2 border-[rgb(var(--border))]" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-[rgb(var(--primary-strong))] border-t-[rgb(var(--primary))]" />
              <div className="absolute inset-[10px] rounded-full bg-[rgb(var(--card)/0.92)]" />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgb(var(--primary-soft-foreground))]">
                PrintFlow
              </p>
              <p className="text-sm font-medium text-[rgb(var(--card-foreground))]">{blockingLoader.message}</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
