import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
// UNCOMMENT WHEN MIGRATING: import { heartbeatRateLimiter } from "@/lib/rate-limiting";

export const runtime = "nodejs";

export async function POST() {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized",
      },
      { status: 401 },
    );
  }

  // UNCOMMENT WHEN MIGRATING: restore per-session rate limiting (2 requests / 60 s).
  // try {
  //   await heartbeatRateLimiter.consume(currentUser.sessionId);
  // } catch {
  //   return NextResponse.json(
  //     { success: false, message: "Too many requests." },
  //     { status: 429, headers: { "Retry-After": "60" } },
  //   );
  // }

  return NextResponse.json({
    success: true,
    message: "Session refreshed.",
  });
}
