"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useGlobalLoader } from "@/lib/ui/global-loader-context";
import { ThemeToggleButton } from "@/components/dashboard/theme-toggle-button";

export function TopNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { showBlockingLoader } = useGlobalLoader();

  const handleHomeClick = () => {
    if (pathname === "/dashboard") {
      return;
    }

    showBlockingLoader("Loading dashboard...", {
      autoHideOnRouteChange: true,
    });
    router.push("/dashboard");
  };

  return (
    <div className="sticky top-0 z-30 px-4 pt-4">
      <nav className="mx-auto flex max-w-7xl items-center justify-between rounded-[24px] border border-[rgb(var(--border))] bg-[rgb(var(--card)/0.78)] px-4 py-3 shadow-[0_20px_56px_-42px_rgb(var(--shadow)/0.45)] backdrop-blur supports-[backdrop-filter]:bg-[rgb(var(--card)/0.72)] sm:px-5">
        <Button
          type="button"
          variant="secondary"
          className="h-10 w-auto rounded-full px-4"
          onClick={handleHomeClick}
        >
          Home
        </Button>
        <ThemeToggleButton />
      </nav>
    </div>
  );
}
