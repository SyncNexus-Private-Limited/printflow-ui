function LoadingBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-[rgb(var(--muted))] ${className}`} />;
}

type CreateFormSkeletonProps = {
  showTypeSelector?: boolean;
  titleWidth?: string;
};

export function CreateFormSkeleton({
  showTypeSelector = false,
  titleWidth = "w-48",
}: CreateFormSkeletonProps) {
  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="space-y-3 px-1">
          <LoadingBlock className="h-4 w-40 rounded-full" />
          <LoadingBlock className={`h-10 ${titleWidth} rounded-full`} />
        </div>

        <section className="rounded-[28px] border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--card)/0.94)] p-5 shadow-[0_22px_52px_-44px_rgb(var(--shadow)/0.18)] sm:p-6">
          <div className="space-y-3">
            <LoadingBlock className="h-7 w-64 rounded-full" />
            <LoadingBlock className="h-4 w-80 max-w-full rounded-full" />
          </div>

          <div className="mt-6 space-y-6">
            {showTypeSelector ? (
              <div className="space-y-3">
                <LoadingBlock className="h-5 w-28 rounded-full" />
                <div className="grid gap-3 md:grid-cols-2">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div
                      key={index}
                      className="rounded-[22px] border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--card)/0.8)] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <LoadingBlock className="h-10 w-10 rounded-xl" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <LoadingBlock className="h-5 w-24 rounded-full" />
                          <LoadingBlock className="h-4 w-40 max-w-full rounded-full" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-5 md:grid-cols-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <LoadingBlock className="h-5 w-24 rounded-full" />
                  <LoadingBlock className="h-12 w-full rounded-2xl" />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <LoadingBlock className="h-5 w-24 rounded-full" />
              <LoadingBlock className="h-28 w-full rounded-2xl" />
            </div>

            <div className="rounded-[22px] border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--muted)/0.42)] p-4">
              <div className="space-y-2">
                <LoadingBlock className="h-5 w-40 rounded-full" />
                <LoadingBlock className="h-4 w-80 max-w-full rounded-full" />
              </div>
            </div>

            <div className="flex justify-end">
              <LoadingBlock className="h-11 w-44 rounded-2xl" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
