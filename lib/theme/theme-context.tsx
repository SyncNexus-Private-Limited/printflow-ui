"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  buildThemeCookieValue,
  isThemeName,
  type ThemeName,
} from "@/lib/ui/client-preferences";

type ThemeContextValue = {
  theme: ThemeName;
  isHydrated: boolean;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

let themeTransitionCleanupFrame: number | null = null;

function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function readResolvedDocumentTheme() {
  const documentTheme = document.documentElement.dataset.theme;

  if (isThemeName(documentTheme)) {
    return documentTheme;
  }

  return null;
}

function persistThemeCookie(theme: ThemeName) {
  document.cookie = buildThemeCookieValue(theme, window.location.protocol === "https:");
}

function resolveInitialTheme(initialTheme: ThemeName) {
  if (typeof document === "undefined") {
    return initialTheme;
  }

  return readResolvedDocumentTheme() ?? initialTheme;
}

function applyThemeSynchronously(theme: ThemeName) {
  const root = document.documentElement;

  root.dataset.themeSwitching = "true";
  void window.getComputedStyle(root).getPropertyValue("color-scheme");

  applyTheme(theme);
  persistThemeCookie(theme);

  void window.getComputedStyle(root).getPropertyValue("color-scheme");

  if (themeTransitionCleanupFrame !== null) {
    window.cancelAnimationFrame(themeTransitionCleanupFrame);
  }

  themeTransitionCleanupFrame = window.requestAnimationFrame(() => {
    themeTransitionCleanupFrame = window.requestAnimationFrame(() => {
      delete root.dataset.themeSwitching;
      themeTransitionCleanupFrame = null;
    });
  });
}

export function ThemeProvider({ children, initialTheme }: { children: ReactNode; initialTheme: ThemeName }) {
  const [theme, setThemeState] = useState<ThemeName>(() => resolveInitialTheme(initialTheme));
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (readResolvedDocumentTheme() !== theme) {
      applyTheme(theme);
    }

    persistThemeCookie(theme);
    setIsHydrated(true);
  }, [theme]);

  const setTheme = useCallback((nextTheme: ThemeName) => {
    setThemeState(nextTheme);
    applyThemeSynchronously(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
  }, [setTheme, theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isHydrated,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
