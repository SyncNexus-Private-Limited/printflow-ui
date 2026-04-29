"use client";

import { useEffect } from "react";
import { useTheme } from "@/lib/theme/theme-context";

export function ThemeShortcut() {
  const { toggleTheme } = useTheme();

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        toggleTheme();
      }
    };

    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [toggleTheme]);

  return null;
}
