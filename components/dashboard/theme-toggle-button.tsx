"use client";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme/theme-context";

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M20 14.2A8.5 8.5 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" strokeLinecap="round" />
    </svg>
  );
}

function ThemeGlyph({ isHydrated, theme }: { isHydrated: boolean; theme: "light" | "dark" }) {
  if (!isHydrated) {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3v18M3 12h18" strokeLinecap="round" />
      </svg>
    );
  }

  return theme === "dark" ? <SunIcon /> : <MoonIcon />;
}

export function ThemeToggleButton() {
  const { theme, isHydrated, toggleTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";
  const ariaLabel = isHydrated ? `Switch to ${nextTheme} theme` : "Toggle theme";

  return (
    <Button
      type="button"
      variant="secondary"
      className="h-11 w-11 rounded-full px-0 shadow-[0_16px_40px_-32px_rgb(var(--shadow)/0.4)]"
      onClick={toggleTheme}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <ThemeGlyph isHydrated={isHydrated} theme={theme} />
    </Button>
  );
}
