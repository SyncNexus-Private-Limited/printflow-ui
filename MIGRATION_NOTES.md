# Migration Notes

## Rate Limiting — Vercel → Self-Hosted

### Current status

Rate limiting is **disabled**. In-memory counters reset on every serverless cold
start, so `RateLimiterMemory` gives no real protection on Vercel. The code is
preserved and commented out, ready to re-enable after migrating to a persistent
Node.js process.

### Files to update when migrating

Search for `UNCOMMENT WHEN MIGRATING` in:

- `lib/rate-limiting/index.ts` — limiter instances
- `app/api/auth/login/route.ts` — IP-based check (5 attempts / 15 min)
- `app/api/auth/heartbeat/route.ts` — session-based check (2 requests / 60 s)

### Option A — In-memory (single Node.js process)

Uncomment `RateLimiterMemory` in `lib/rate-limiting/index.ts` and the two
`consume()` blocks in the route handlers. No extra infrastructure needed.
Works correctly only when a single `next start` process handles all traffic.

### Option B — Redis (multi-instance or future scale-out)

1. Provision a Redis instance (Upstash, Redis Cloud, self-hosted).
2. Add `REDIS_URL` to your environment variables.
3. Replace `RateLimiterMemory` with `RateLimiterRedis` in
   `lib/rate-limiting/index.ts` (the constructor signature is identical).
4. Uncomment the `consume()` blocks in the route handlers.

### Smoke test after enabling

```bash
# Login rate limit — 6th attempt should return 429
for i in {1..6}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"any","password":"wrong"}'
done
# Expected: 401 401 401 401 401 429

# Heartbeat rate limit — 3rd rapid request should return 429
SESSION_COOKIE="dlms_session=<your-token>"
for i in {1..3}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/heartbeat \
    -H "Cookie: $SESSION_COOKIE"
done
# Expected: 200 200 429
```
