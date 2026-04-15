function LoadingBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-[rgb(var(--muted))] ${className}`} />;
}

function MetricCardSkeleton() {
  return (
    <div className="rounded-3xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--card)/0.94)] p-4 shadow-[0_22px_50px_-42px_rgb(var(--shadow)/0.16)] sm:p-5">
      <div className="space-y-3.5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <LoadingBlock className="h-3 w-24 rounded-full" />
            <LoadingBlock className="h-10 w-20 rounded-full" />
          </div>
          <LoadingBlock className="mt-1 h-3 w-3 rounded-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LoadingBlock className="h-4 w-20 rounded-full" />
          <LoadingBlock className="h-1.5 w-1.5 rounded-full" />
          <LoadingBlock className="h-4 w-16 rounded-full" />
          <LoadingBlock className="h-1.5 w-1.5 rounded-full" />
          <LoadingBlock className="h-4 w-12 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function SectionShell({
  titleWidth,
  descriptionWidth,
  children,
  className = "",
}: {
  titleWidth: string;
  descriptionWidth?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[28px] border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--card)/0.94)] p-5 shadow-[0_22px_52px_-44px_rgb(var(--shadow)/0.18)] sm:p-6 ${className}`}
    >
      <div className="space-y-3">
        <LoadingBlock className={`h-8 ${titleWidth} rounded-full`} />
        {descriptionWidth ? <LoadingBlock className={`h-4 ${descriptionWidth} rounded-full`} /> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function DashboardLoading() {
  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="space-y-2 px-1">
          <LoadingBlock className="h-10 w-44 rounded-full" />
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <MetricCardSkeleton key={index} />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <SectionShell titleWidth="w-44" descriptionWidth="w-72">
            <div className="space-y-5">
              <div className="grid grid-cols-[1.3fr_1fr_0.8fr_0.8fr_0.8fr] gap-4">
                <LoadingBlock className="h-4 w-12 rounded-full" />
                <LoadingBlock className="h-4 w-20 rounded-full" />
                <LoadingBlock className="h-4 w-14 rounded-full" />
                <LoadingBlock className="h-4 w-16 rounded-full" />
                <LoadingBlock className="h-4 w-12 rounded-full" />
              </div>

              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="grid grid-cols-[1.3fr_1fr_0.8fr_0.8fr_0.8fr] gap-4">
                    <LoadingBlock className="h-5 w-28 rounded-full" />
                    <LoadingBlock className="h-5 w-24 rounded-full" />
                    <LoadingBlock className="h-5 w-16 rounded-full" />
                    <LoadingBlock className="h-5 w-16 rounded-full" />
                    <LoadingBlock className="h-5 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </SectionShell>

          <SectionShell titleWidth="w-48" descriptionWidth="w-44">
            <div className="space-y-4">
              <LoadingBlock className="h-5 w-40 rounded-full" />
              <LoadingBlock className="h-5 w-52 rounded-full" />
            </div>
          </SectionShell>
        </section>

        <SectionShell titleWidth="w-44" descriptionWidth="w-80">
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex items-start justify-between gap-4 rounded-2xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--card)/0.75)] px-4 py-4"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <LoadingBlock className="h-5 w-56 rounded-full" />
                  <LoadingBlock className="h-4 w-72 max-w-full rounded-full" />
                </div>
                <div className="shrink-0 space-y-2 text-right">
                  <LoadingBlock className="ml-auto h-5 w-16 rounded-full" />
                  <LoadingBlock className="ml-auto h-4 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </SectionShell>
      </div>
    </main>
  );
}