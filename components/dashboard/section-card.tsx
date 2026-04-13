import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <section className="rounded-[24px] border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--card)/0.94)] p-5 shadow-[0_22px_50px_-42px_rgb(var(--shadow)/0.16)] backdrop-blur-[10px]">
      <div className="mb-4 space-y-1.5">
        <h2 className="text-lg font-semibold text-[rgb(var(--card-foreground))]">{title}</h2>
        {description ? <p className="text-sm text-[rgb(var(--muted-foreground)/0.94)]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
