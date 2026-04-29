import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { Manrope } from "next/font/google";
import { GlobalUiProvider } from "@/components/providers/global-ui-provider";
import {
  DEFAULT_THEME,
  getPreHydrationUiBootstrapScript,
  isThemeName,
  THEME_COOKIE_NAME,
} from "@/lib/ui/client-preferences";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "PrintFlow UI",
  description: "Minimal login flow for PrintFlow UI",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function RootLayout({ children }: RootLayoutProps) {
  const cookieStore = await cookies();
  const themeCookieValue = cookieStore.get(THEME_COOKIE_NAME)?.value;
  const hasThemeCookie = isThemeName(themeCookieValue);
  const initialTheme = hasThemeCookie ? themeCookieValue : DEFAULT_THEME;
  const preHydrationUiBootstrapScript = getPreHydrationUiBootstrapScript(
    hasThemeCookie,
    initialTheme,
  );

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme={initialTheme}
      data-dashboard-sidebar-collapsed="false"
    >
      <head>
        <script
          id="printflow-ui-bootstrap"
          dangerouslySetInnerHTML={{
            __html: preHydrationUiBootstrapScript,
          }}
        />
      </head>
      <body className={manrope.variable}>
        <GlobalUiProvider initialTheme={initialTheme}>{children}</GlobalUiProvider>
      </body>
    </html>
  );
}
