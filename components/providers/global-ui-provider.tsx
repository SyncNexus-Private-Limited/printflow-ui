"use client";

import type { ReactNode } from "react";
import { ThemeShortcut } from "@/components/theme/theme-shortcut";
import { GlobalLoader } from "@/components/ui/global-loader";
import { ThemeProvider } from "@/lib/theme/theme-context";
import type { ThemeName } from "@/lib/ui/client-preferences";
import { GlobalLoaderProvider } from "@/lib/ui/global-loader-context";

type GlobalUiProviderProps = {
  children: ReactNode;
  initialTheme: ThemeName;
};

export function GlobalUiProvider({ children, initialTheme }: GlobalUiProviderProps) {
  return (
    <ThemeProvider initialTheme={initialTheme}>
      <ThemeShortcut />
      <GlobalLoaderProvider>
        {children}
        <GlobalLoader />
      </GlobalLoaderProvider>
    </ThemeProvider>
  );
}
