"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme/theme-context";

function ThemeGlyph({ isHydrated, theme }: { isHydrated: boolean; theme: "light" | "dark" }) {
  if (!isHydrated) {
    return <SunMoon className="h-[18px] w-[18px]" aria-hidden="true" strokeWidth={1.8} />;
  }

  return theme === "dark" ? (
    <Sun className="h-[18px] w-[18px]" aria-hidden="true" strokeWidth={1.8} />
  ) : (
    <Moon className="h-[18px] w-[18px]" aria-hidden="true" strokeWidth={1.8} />
  );
}

export function ThemeToggleButton() {
  const { theme, isHydrated, toggleTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";
  const ariaLabel = isHydrated ? `Switch to ${nextTheme} theme` : "Toggle theme";

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      className="rounded-xl shadow-[0_16px_40px_-32px_rgb(var(--shadow)/0.4)]"
      onClick={toggleTheme}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <ThemeGlyph isHydrated={isHydrated} theme={theme} />
    </Button>
  );
}
