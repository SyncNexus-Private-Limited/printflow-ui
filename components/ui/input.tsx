import * as React from "react";
import { cn } from "@/lib/utils/cn";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2 text-sm text-[rgb(var(--card-foreground))]",
        "placeholder:text-[rgb(var(--muted-foreground))] focus:border-[rgb(var(--primary))] focus:outline-none focus:ring-4 focus:ring-[rgb(var(--primary)/0.14)]",
        "disabled:cursor-not-allowed disabled:bg-[rgb(var(--muted))] disabled:text-[rgb(var(--muted-foreground))]",
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";
