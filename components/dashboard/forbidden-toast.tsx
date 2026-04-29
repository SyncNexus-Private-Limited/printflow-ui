"use client";

import { useEffect } from "react";
import { useToast } from "@/lib/ui/toast-context";

// Detects ?forbidden=1 in the URL (set by server-side permission redirects),
// shows a one-shot toast, then removes the param so it doesn't persist on refresh.
// Reads window.location.search directly to avoid useSearchParams() Suspense/hydration
// timing issues when rendered from an async server component boundary.
export function ForbiddenToast() {
  const { showToast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("forbidden") !== "1") return;

    params.delete("forbidden");
    const newSearch = params.toString();
    window.history.replaceState(null, "", newSearch ? `/dashboard?${newSearch}` : "/dashboard");

    showToast("You don't have permission to access that page.", { duration: 3000 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
