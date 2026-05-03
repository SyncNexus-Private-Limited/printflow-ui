import "server-only";

// ---------------------------------------------------------------------------
// RATE LIMITING — CURRENTLY DISABLED (Vercel / serverless deployment)
//
// In-memory limiters do not persist state across serverless function
// invocations, so enabling them on Vercel gives each cold-start a fresh
// counter and provides no real protection.
//
// UNCOMMENT WHEN MIGRATING to a self-hosted Node.js process (Docker, VM, etc.)
// where a single long-lived process handles all requests:
//
//   1. Uncomment the import and limiter instances below.
//   2. Uncomment the consume() calls in:
//        app/api/auth/login/route.ts
//        app/api/auth/heartbeat/route.ts
//   3. For multi-instance deployments, swap RateLimiterMemory for
//      RateLimiterRedis and add a REDIS_URL environment variable.
// ---------------------------------------------------------------------------

// UNCOMMENT WHEN MIGRATING:
// import { RateLimiterMemory } from "rate-limiter-flexible";

// Login: 5 attempts per 15-minute window per IP address.
// UNCOMMENT WHEN MIGRATING:
// export const loginRateLimiter = new RateLimiterMemory({
//   points: 5,
//   duration: 900, // 15 minutes in seconds
// });

// Heartbeat: 2 requests per 60-second window per session ID.
// UNCOMMENT WHEN MIGRATING:
// export const heartbeatRateLimiter = new RateLimiterMemory({
//   points: 2,
//   duration: 60,
// });

// Extracts the originating client IP from standard proxy headers.
// Falls back to "unknown" when no header is present (direct connections).
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
