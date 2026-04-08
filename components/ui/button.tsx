import * as React from "react";
import { cn } from "@/lib/utils/cn";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

const buttonVariants = {
  primary:
    "border-transparent bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))] shadow-[0_20px_44px_-28px_rgb(var(--shadow)/0.65)] hover:bg-[rgb(var(--primary-strong))]",
  secondary:
    "border-[rgb(var(--border))] bg-[rgb(var(--card))] text-[rgb(var(--foreground))] hover:bg-[rgb(var(--muted))]",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, type = "button", variant = "primary", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex h-10 w-full items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
          "disabled:cursor-not-allowed disabled:opacity-60",
          buttonVariants[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

