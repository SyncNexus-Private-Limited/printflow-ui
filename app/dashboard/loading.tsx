function LoadingBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-[rgb(var(--muted))] ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[rgb(var(--background))]">
      <div className="sticky top-0 z-40 px-4 pt-4 sm:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-[96rem] flex-wrap items-start justify-between gap-2.5 rounded-[24px] border border-[rgb(var(--border))] bg-[rgb(var(--card)/0.78)] px-3 py-2.5 shadow-[0_20px_56px_-42px_rgb(var(--shadow)/0.45)] backdrop-blur supports-[backdrop-filter]:bg-[rgb(var(--card)/0.72)] sm:flex-nowrap sm:items-center sm:gap-3 sm:px-4">
          <div className="flex items-center gap-2">
            <LoadingBlock className="h-10 w-10 rounded-xl lg:hidden" />
            <LoadingBlock className="h-10 w-24 rounded-2xl sm:w-36" />
          </div>
          <div className="ml-auto flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-none sm:gap-3">
            <LoadingBlock className="h-10 min-w-0 flex-1 rounded-2xl sm:w-72 sm:flex-none lg:w-80" />
            <LoadingBlock className="h-10 w-10 rounded-xl" />
            <LoadingBlock className="h-10 w-10 rounded-xl" />
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[96rem] gap-4 px-4 pb-6 pt-4 sm:px-6 lg:gap-6 xl:px-8">
        <aside className="hidden w-72 shrink-0 rounded-[28px] border border-[rgb(var(--border))] bg-[rgb(var(--card)/0.92)] p-4 shadow-[0_24px_70px_-50px_rgb(var(--shadow)/0.38)] lg:block">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <LoadingBlock className="h-3 w-20 rounded-full" />
              <LoadingBlock className="h-4 w-24 rounded-full" />
            </div>
            <LoadingBlock className="h-10 w-10 rounded-xl" />
          </div>
          <div className="mt-5 space-y-1.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center gap-3">
                  <LoadingBlock className="h-5 w-5 rounded-full" />
                  <LoadingBlock className="h-4 w-28 rounded-full" />
                  {index === 1 || index === 3 || index === 4 ? <LoadingBlock className="ml-auto h-4 w-4 rounded-full" /> : null}
                </div>
                {index === 1 || index === 3 || index === 4 ? (
                  <div className="ml-2 space-y-2 border-l border-[rgb(var(--border)/0.7)] pl-5">
                    <LoadingBlock className="h-4 w-28 rounded-full" />
                    <LoadingBlock className="h-4 w-32 rounded-full" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <main className="min-h-screen px-4 py-8">
            <div className="mx-auto max-w-7xl space-y-8">
              <div className="space-y-3 px-1">
                <LoadingBlock className="h-3 w-20 rounded-full" />
                <LoadingBlock className="h-9 w-44 rounded-full" />
                <LoadingBlock className="h-4 w-72 max-w-full rounded-full" />
              </div>

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-[24px] border border-[rgb(var(--border))] bg-[rgb(var(--card)/0.92)] p-5 shadow-[0_18px_48px_-38px_rgb(var(--shadow)/0.28)]"
                  >
                    <div className="space-y-4">
                      <LoadingBlock className="h-4 w-24" />
                      <LoadingBlock className="h-9 w-32" />
                      <LoadingBlock className="h-4 w-full max-w-[18rem]" />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <LoadingBlock className="h-16 w-full" />
                        <LoadingBlock className="h-16 w-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
