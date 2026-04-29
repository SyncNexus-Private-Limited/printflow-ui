"use client";

import { useEffect } from "react";

export function SessionHeartbeat() {
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        const response = await fetch("/api/auth/heartbeat", {
          method: "POST",
          cache: "no-store",
        });

        if (response.status === 401) {
          // Session was revoked (user locked or deactivated). Hard-navigate
          // through /api/auth/clear so the cookie is stripped before /login,
          // preventing the middleware from bouncing back to /dashboard.
          window.location.replace("/api/auth/clear");
        }
      } catch {
        // Network error — ignore, will retry on next interval
      }
    };

    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, 5 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
}

