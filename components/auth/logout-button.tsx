"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useGlobalLoader } from "@/lib/ui/global-loader-context";

export function LogoutButton() {
  const router = useRouter();
  const { showBlockingLoader } = useGlobalLoader();
  const [isPending, setIsPending] = useState(false);

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
      // router.refresh();
      setIsPending(false);
    }
  };

  return (
    <Button className="w-auto px-4" variant="secondary" onClick={handleLogout} disabled={isPending}>
      {isPending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
