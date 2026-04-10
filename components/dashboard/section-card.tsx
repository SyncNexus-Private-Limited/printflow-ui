import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <section className="rounded-[24px] border border-[rgb(var(--border))] bg-[rgb(var(--card)/0.96)] p-5 shadow-[0_20px_56px_-38px_rgb(var(--shadow)/0.35)] backdrop-blur">
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold text-[rgb(var(--card-foreground))]">{title}</h2>
        {description ? <p className="text-sm text-[rgb(var(--muted-foreground))]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
