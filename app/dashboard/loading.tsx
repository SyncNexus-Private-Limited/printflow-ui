function LoadingBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-[rgb(var(--muted))] ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[28px] border border-[rgb(var(--border))] bg-[linear-gradient(135deg,rgb(var(--card))_0%,rgb(var(--primary-soft))_120%)] p-6 shadow-[0_24px_70px_-42px_rgb(var(--shadow)/0.4)]">
          <div className="space-y-4">
            <LoadingBlock className="h-6 w-32 rounded-full" />
            <LoadingBlock className="h-10 w-56" />
            <LoadingBlock className="h-4 w-72 max-w-full" />
          </div>
        </section>

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
  );
}
