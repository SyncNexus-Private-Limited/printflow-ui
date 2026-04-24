# CLAUDE.md

## Project Overview

`printflow-ui` is an internal print/order management system for multiple branches. It manages orders, customers, inventory, payments, employees, and expenses. Business invariants (pricing, totals, inventory deduction, order codes) live in PostgreSQL where possible.

---

## Architecture

```
React UI (Server Components by default)
  -> Next.js Route Handlers  (/app/api/*)
  -> PostgreSQL (functions / triggers / tables)
```

- Pages fetch data server-side via `lib/dashboard/queries.ts` (marked `server-only`).
- Client components are scoped to interactive islands (forms, filters, list controls).
- Route handlers are thin: validate → authorize → call DB → return typed response.
- PostgreSQL is the source of truth for all financial totals, inventory counts, and order codes.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 (`@import "tailwindcss"`) |
| Forms | React Hook Form + `@hookform/resolvers` |
| Validation | Zod 4 |
| DB client | `pg` (direct SQL, no ORM) |
| Auth tokens | `jose` (JWT, HS256, HTTP-only cookie) |
| Icons | `lucide-react` |
| State | Server Components + React context only; no Redux, no TanStack Query, no SWR |

---

## Repository Structure

```
app/
  (auth)/login/         # Login page (public)
  api/
    auth/login/         # POST — authenticate_user(), create session
    auth/logout/        # POST — revoke session
    auth/heartbeat/     # POST — touch session last_seen_at
    expenses/           # POST — create branch/employee expense
  dashboard/            # Protected dashboard pages (Server Components)
  globals.css           # Tailwind 4 import + CSS variable tokens (light + dark)

components/
  auth/                 # LoginForm, LogoutButton
  dashboard/            # Shell, header, sidebar, data tables, list controls, etc.
  expenses/             # Expense form fields
  providers/            # GlobalUiProvider
  ui/                   # Button, Input, Select, Textarea, Spinner, GlobalLoader

lib/
  auth/
    session.ts          # JWT sign/verify, cookie helpers (jose)
    current-user.ts     # DB session lookup + touch (server-only)
  db/
    postgres.ts         # Singleton pg.Pool (server-only, globalThis cache)
  dashboard/
    queries.ts          # All dashboard DB queries (server-only, parameterized SQL)
    types.ts            # Shared row types for dashboard queries
    *-page-filters.ts   # Filter/sort state parsers per page
  expenses/
    schema.ts           # Zod discriminated union for expense creation
    types.ts / queries.ts / mutations.ts
  validations/
    auth.ts             # loginSchema
    dashboard.ts        # branchFilterSchema
  ui/                   # GlobalLoaderContext, client-preferences
  theme/                # ThemeContext
  utils/                # cn(), format()

db/
  migrations/           # SQL migration files
  seeds/dev_seed.sql
  reset/dev_reset.sql

scripts/db/             # Node ESM migration tooling (.mjs)
middleware.ts           # Protects /dashboard/*, redirects /login if already authed
```

---

## Common Commands

```bash
npm run dev                                    # Start dev server
npm run build                                  # Production build
npm run start                                  # Start production server
npm run typecheck                              # tsc --noEmit
```

### DB Commands

```bash
npm run db:target                              # Print current DB env, name, user
npm run db:new -- <name>                       # Create timestamped migration template
npm run db:migrate -- --dry-run                # Preview pending migrations
npm run db:migrate                             # Apply pending migrations
npm run db:rollback -- --dry-run               # Preview rollback
npm run db:rollback                            # Roll back latest applied migration
npm run db:dump                                # Schema-only pg_dump
npm run db:seed:dev -- --confirm printflow_dev
npm run db:reset:dev -- --confirm printflow_dev
```

**npm flag rule — `--` is required:**
```bash
# Correct
npm run db:reset:dev -- --confirm printflow_dev

# Wrong (flag is silently ignored)
npm run db:reset:dev --confirm printflow_dev
```

---

## Database Workflow

- Migrations live in `db/migrations/`.
- Files use `-- migrate:up` / `-- migrate:down` blocks.
- Applied migrations tracked in `schema_migrations`; checksums validated on apply and rollback.
- Two migrations currently exist: `20260410_000001_baseline.sql` and `20260414_131102_expense_schema_hardening.sql`.
- Use `npm run db:new -- <name>` for all new migrations. Do not rename existing migration files.
- Do not edit applied migrations without explicit user confirmation that it is safe.
- Run `npm run db:target` before any DB operation to confirm the target.
- Prefer dry runs before applying: `db:migrate -- --dry-run` / `db:rollback -- --dry-run`.

### Destructive commands (`db:seed:dev`, `db:reset:dev`)

All three gates must be satisfied:
1. `ALLOW_DESTRUCTIVE_DB_COMMANDS=true`
2. Connected DB name is in `DEV_DB_NAME_ALLOWLIST`
3. `-- --confirm <exact_db_name>` passed on the command line

These are local/test only. Do not run in production.

### Production rules

- Production runs only `npm run db:migrate`.
- Production rollback is blocked by default (`ALLOW_PRODUCTION_ROLLBACK` must be explicitly set to `"true"`).

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (all DB tooling and app pool) |
| `APP_SECRET` | Signs JWT session tokens |
| `APP_BASE_URL` | Base URL for the app |
| `NODE_ENV` | Standard Node env |
| `APP_ENV` | Optional explicit app env; falls back to `NODE_ENV` |
| `SESSION_COOKIE_NAME` | Cookie name (default: `dlms_session`) |
| `SESSION_MAX_AGE` | Session lifetime in seconds (default: 604800) |
| `ACTIVE_USER_WINDOW_MINUTES` | Active user window in minutes (default: 15) |
| `ALLOW_DESTRUCTIVE_DB_COMMANDS` | Must be `"true"` for destructive local/test commands |
| `ALLOW_PRODUCTION_ROLLBACK` | Set `"true"` to allow production rollback |
| `DEV_DB_NAME_ALLOWLIST` | Comma-separated DB names allowed for destructive commands |
| `POSTGRES_POOL_MAX` | Optional pool max connections |
| `POSTGRES_IDLE_TIMEOUT_MS` | Optional pool idle timeout |
| `POSTGRES_CONNECTION_TIMEOUT_MS` | Optional pool connection timeout |
| `LOG_POSTGRES_POOL` | Set `"true"` to log pool initialization |
| `SESSION_TOUCH_INTERVAL_SECONDS` | Min interval between session touch updates (default: 60) |

- Read `.env.local.example` for variable names only. Never print `.env` values.
- Never commit secrets.
- Do not modify `.env` files unless explicitly asked.
- Keep `DATABASE_URL` and `APP_SECRET` server-side only.

---

## Development Rules

- Inspect relevant files before editing.
- Make minimal, targeted changes. Preserve existing naming and structure.
- Avoid broad refactors unless explicitly requested.
- Do not introduce dependencies without explicit approval.
- Do not invent scripts, folders, API routes, env vars, or DB objects.
- Prefer existing utilities, types, and components.
- Keep TypeScript strict. Avoid `any` unless unavoidable and justified.
- Maintain correct server/client boundaries:
  - `lib/db/postgres.ts` and `lib/auth/current-user.ts` are `server-only`.
  - Do not import these from client components.
- Validate after code edits where feasible: `npm run typecheck`, `npm run build`.

---

## Authentication Rules

- Login form: React Hook Form + Zod (`loginSchema` in `lib/validations/auth.ts`).
- Login API validates input server-side, then calls `SELECT authenticate_user($1, $2)`.
- `authenticate_user` handles account lock (5 failed attempts), inactive check, and bcrypt verification via `pgcrypto`.
- On success, a JWT is signed with `jose` (HS256) and stored as an HTTP-only cookie.
- The JWT payload (`SessionPayload`) contains: `sessionId`, `userId`, `role`, `branchId`, `username`.
- Session token hash (SHA-256) is stored in `app_sessions.session_token_hash` for server-side validation.
- `getCurrentUser()` in `lib/auth/current-user.ts` verifies the JWT, looks up the live session in DB, and optionally touches `last_seen_at`.
- `middleware.ts` protects `/dashboard/**` and redirects `/login` when session is already valid. Inspect it before changing route protection.
- Auth/session code is server-only. Do not expose tokens, hashes, or secrets to the client.
- `create_user_with_auth` is the DB function for user creation (admin only, enforced in DB).

---

## API Rules

- Use Next.js Route Handlers under `app/api/*`. Set `export const runtime = "nodejs"` for DB access.
- Validate all incoming payloads with Zod. Use `safeParse`; return structured field errors on failure.
- Authorize before any DB mutation (check session via `getCurrentUser()`).
- Return typed, minimal JSON: `{ success: boolean, message: string, ... }`.
- Do not leak internal SQL errors to clients — catch DB errors and return generic 500 messages.
- Use parameterized queries only. Never concatenate untrusted input into SQL strings.
- Branch-scope all queries: non-admin users are restricted to their `branchId`; admins can query `null` (all branches).
- Derived order fields (`total_amount`, `payable_amount`, `paid_amount`, `payment_status`) are managed by DB triggers — do not set them directly.

---

## UI Rules

- Use existing components from `components/`. Avoid creating new UI primitives unless necessary.
- Tailwind CSS 4: `@import "tailwindcss"` pattern. Do not use `@tailwind base/components/utilities`.
- Use CSS variable tokens from `app/globals.css`. Reference them as `rgb(var(--token))` in inline styles or Tailwind utilities.
- Both light (`[data-theme]` default) and dark (`[data-theme="dark"]`) themes are defined. Maintain dark mode compatibility.
- Use `lucide-react` for icons.
- Forms: always use React Hook Form + Zod resolver. Follow the pattern in `components/auth/login-form.tsx`.
- Keep client components (`"use client"`) only where interactivity requires them. Prefer Server Components.
- Server Component pages fetch data directly via `lib/dashboard/queries.ts`.
- Do not import `server-only` modules into client components.
- Use `lib/utils/cn.ts` for conditional class merging.

---

## DB Schema Quick Reference

**Core tables:** `branches`, `users`, `user_auth`, `app_sessions`, `customers`, `vendors`, `inventory`, `inventory_pricing`, `orders`, `order_items`, `payments`, `order_vendors`, `offer_items`, `order_offer_items`, `branch_expenses`, `employee_expenses`, `expense_categories`, `expense_attachments`, `order_sequences`

**Enums:** `user_role` (admin/manager/operator/staff), `order_status`, `payment_mode`, `payment_status`, `inventory_unit`, `customer_type`

**Key DB functions (all confirmed in migrations):**
- `authenticate_user(username, password)` → `uuid | null`
- `create_user_with_auth(admin_id, ...)` → `uuid` (admin-only)
- `generate_order_code(branch_id, order_date)` → `text`
- `recalculate_order_financials(order_id)` → recalculates totals/payment_status
- `set_updated_at()` — generic trigger for `updated_at` columns

**Key triggers (all confirmed):**
- `trigger_set_order_code` — auto-generates `order_code` on INSERT to `orders`
- `trg_validate_order_header` — guards immutable fields, branch match, derived field writes
- `trg_apply_order_item_inventory` — deducts/restores inventory on `order_items` changes
- `trg_recalculate_order_after_items` / `_after_payments` / `_after_discount` — keep order totals in sync
- `trg_restore_inventory_on_cancel` — restores inventory when order is cancelled
- `trg_validate_payment` — validates branch/user match for payments
- `trg_validate_inventory_pricing` — prevents date range overlaps per branch/item/customer_type
- `set_updated_at` triggers on all timestamped tables

---

## Safety Rules

- Never run `db:reset:dev` or `db:seed:dev` unless explicitly requested and all three safety gates are confirmed.
- Never edit applied migrations without explicit confirmation.
- Never run production rollback without explicit confirmation and `ALLOW_PRODUCTION_ROLLBACK=true`.
- Never print or log `.env` values, session tokens, or password hashes.
- Never concatenate untrusted input into SQL.
- Never expose `lib/db/postgres.ts` or session internals to client code.
- Do not add ORMs (Prisma, Drizzle, Sequelize, TypeORM) without explicit approval.
- Do not add Redux, Zustand, TanStack Query, SWR, or other state libraries without explicit approval.

---

## Validation Before Final Response

After code changes, run where applicable:
```bash
npm run typecheck   # Must pass with no errors
npm run build       # Must pass for production-affecting changes
```

---

## What Not To Do

- Do not introduce an ORM.
- Do not add Redux, TanStack Query, SWR, or global state libraries.
- Do not compute pricing or order totals in application code — use the DB.
- Do not manually set `order_code`, `total_amount`, `payable_amount`, `paid_amount`, or `payment_status` in INSERT/UPDATE statements — they are DB-managed.
- Do not rename or edit applied migration files.
- Do not run destructive DB commands without explicit request + confirmation.
- Do not leak SQL errors to API clients.
- Do not import server-only modules into client components.
- Do not make broad component rewrites or add premature abstractions.
- Do not claim scripts, files, or DB objects exist unless verified in the repository.

---

## Final Response Format

After completing a task, summarize:
- **Files changed** (paths)
- **Commands run** and their outcomes
- **Commands not run** and why
- **DB commands run**, if any
- **Migration impact**, if any
- **Risks or follow-up actions**, if any
