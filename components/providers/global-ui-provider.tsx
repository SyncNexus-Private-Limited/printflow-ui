"use client";

import type { ReactNode } from "react";
import { ThemeShortcut } from "@/components/theme/theme-shortcut";
import { GlobalLoader } from "@/components/ui/global-loader";
import { ToastContainer } from "@/components/ui/toast";
import { ThemeProvider } from "@/lib/theme/theme-context";
import type { ThemeName } from "@/lib/ui/client-preferences";
import { GlobalLoaderProvider } from "@/lib/ui/global-loader-context";
import { ToastProvider } from "@/lib/ui/toast-context";

type GlobalUiProviderProps = {
  children: ReactNode;
  initialTheme: ThemeName;
};

export function GlobalUiProvider({ children, initialTheme }: GlobalUiProviderProps) {
  return (
    <ThemeProvider initialTheme={initialTheme}>
      <ThemeShortcut />
      <GlobalLoaderProvider>
        <ToastProvider>
          {children}
          <GlobalLoader />
          <ToastContainer />
        </ToastProvider>
      </GlobalLoaderProvider>
    </ThemeProvider>
  );
}
