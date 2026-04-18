import { cn } from "@/lib/utils/cn";

type SpinnerProps = {
  size?: "xs" | "sm" | "md";
  className?: string;
  label?: string;
  ariaHidden?: boolean;
};

const spinnerSizes = {
  xs: "h-3.5 w-3.5 border-[1.5px]",
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
} as const;

export function Spinner({
  size = "sm",
  className,
  label = "Loading",
  ariaHidden = false,
}: SpinnerProps) {
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      role={ariaHidden ? undefined : "status"}
      aria-live={ariaHidden ? undefined : "polite"}
      aria-label={ariaHidden ? undefined : label}
      aria-hidden={ariaHidden || undefined}
    >
      <span
        className={cn(
          "inline-block rounded-full border-[rgb(var(--border)/0.72)] border-r-[rgb(var(--primary))] border-t-[rgb(var(--primary-soft-foreground))] animate-spin motion-reduce:animate-none",
          spinnerSizes[size],
        )}
      />
      {!ariaHidden ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
