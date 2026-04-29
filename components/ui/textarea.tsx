import * as React from "react";
import { cn } from "@/lib/utils/cn";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-28 w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-3 py-2.5 text-sm text-[rgb(var(--card-foreground))]",
          "placeholder:text-[rgb(var(--muted-foreground))] focus:border-[rgb(var(--primary))] focus:ring-4 focus:ring-[rgb(var(--primary)/0.14)] focus:outline-none",
          "disabled:cursor-not-allowed disabled:bg-[rgb(var(--muted))] disabled:text-[rgb(var(--muted-foreground))]",
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";
