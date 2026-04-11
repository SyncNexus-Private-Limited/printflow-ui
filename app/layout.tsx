import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Manrope } from "next/font/google";
import { GlobalUiProvider } from "@/components/providers/global-ui-provider";
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

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={manrope.variable}>
        <GlobalUiProvider>{children}</GlobalUiProvider>
      </body>
    </html>
  );
}
