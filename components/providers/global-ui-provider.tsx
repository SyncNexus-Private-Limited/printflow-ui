"use client";

import type { ReactNode } from "react";
import { ThemeShortcut } from "@/components/theme/theme-shortcut";
import { GlobalLoader } from "@/components/ui/global-loader";
import { ThemeProvider } from "@/lib/theme/theme-context";
import { GlobalLoaderProvider } from "@/lib/ui/global-loader-context";

type GlobalUiProviderProps = {
  children: ReactNode;
};

export function GlobalUiProvider({ children }: GlobalUiProviderProps) {
  return (
    <ThemeProvider>
      <ThemeShortcut />
      <GlobalLoaderProvider>
        {children}
        <GlobalLoader />
      </GlobalLoaderProvider>
    </ThemeProvider>
  );
}
