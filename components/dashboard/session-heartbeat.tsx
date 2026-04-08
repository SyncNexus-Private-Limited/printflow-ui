"use client";

import { useEffect } from "react";

export function SessionHeartbeat() {
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        await fetch("/api/auth/heartbeat", {
          method: "POST",
          cache: "no-store",
        });
      } catch {
        return;
      }
    };

    void sendHeartbeat();
    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, 5 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
}

