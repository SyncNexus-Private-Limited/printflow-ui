import { suggestCanonicalClasses, cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
};

export function SectionCard({
  title,
  description,
  children,
  className,
  headerClassName,
  bodyClassName,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        suggestCanonicalClasses(
          "rounded-[24px] border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--card)/0.94)] p-5 shadow-[0_22px_50px_-42px_rgb(var(--shadow)/0.16)] backdrop-blur-[10px]",
        ),
        className,
      )}
    >
      <div className={cn("mb-4 space-y-1.5", headerClassName)}>
        <h2 className="text-lg font-semibold text-[rgb(var(--card-foreground))]">{title}</h2>
        {description ? <p className="text-sm text-[rgb(var(--muted-foreground)/0.94)]">{description}</p> : null}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
