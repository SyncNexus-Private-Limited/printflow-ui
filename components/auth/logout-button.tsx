"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { useGlobalLoader } from "@/lib/ui/global-loader-context";

type LogoutButtonProps = {
  iconOnly?: boolean;
  className?: string;
  title?: string;
};

export function LogoutButton({ iconOnly = false, className, title }: LogoutButtonProps) {
  const router = useRouter();
  const { showBlockingLoader } = useGlobalLoader();
  const [isPending, setIsPending] = useState(false);
  const accessibleLabel = isPending ? "Signing out..." : (title ?? "Sign out");

  const handleLogout = async () => {
    setIsPending(true);
    showBlockingLoader("Signing out...", {
      autoHideOnRouteChange: true,
    });

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      router.replace("/login");
      setIsPending(false);
    }
  };

  return (
    <Button
      size={iconOnly ? "icon" : "default"}
      className={cn(
        iconOnly ? "rounded-xl shadow-[0_16px_40px_-32px_rgb(var(--shadow)/0.4)]" : "px-4",
        className,
      )}
      variant="secondary"
      onClick={handleLogout}
      disabled={isPending}
      aria-label={accessibleLabel}
      title={accessibleLabel}
    >
      {iconOnly ? (
        <>
          <LogOut className="h-4.5 w-4.5" aria-hidden="true" strokeWidth={1.8} />
          <span className="sr-only">{accessibleLabel}</span>
        </>
      ) : isPending ? (
        "Signing out..."
      ) : (
        "Sign out"
      )}
    </Button>
  );
}
