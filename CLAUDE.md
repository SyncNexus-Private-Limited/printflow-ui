# CLAUDE.md — printflow-ui

## Project

Internal print/order management system for multiple branches. Manages orders, customers, inventory, payments, employees, and expenses. Business invariants (pricing, totals, inventory deduction, order codes) live in PostgreSQL.

## Architecture

```
React UI (Server Components by default)
  -> Next.js Route Handlers (/app/api/*)
  -> PostgreSQL (functions / triggers / tables)
```

- Pages fetch data server-side via `lib/dashboard/queries.ts` (marked `server-only`)
- Client components scoped to interactive islands (forms, filters, list controls)
- Route handlers: validate → authorize → call DB → return typed response
- PostgreSQL is source of truth for all financial totals, inventory counts, and order codes

## Stack

| Layer       | Choice                                   |
| ----------- | ---------------------------------------- |
| Framework   | Next.js 15 (App Router)                  |
| Language    | TypeScript 5 (strict)                    |
| Styling     | Tailwind CSS 4 (`@import "tailwindcss"`) |
| Forms       | React Hook Form + `@hookform/resolvers`  |
| Validation  | Zod 4                                    |
| DB client   | `pg` (direct SQL, no ORM)                |
| Auth tokens | `jose` (JWT, HS256, HTTP-only cookie)    |
| Icons       | `lucide-react`                           |
| State       | Server Components + React context only   |

## Code Quality

- Prettier 3 formats code; `prettier-plugin-tailwindcss` sorts Tailwind classes
- SQL is formatted through `prettier-plugin-sql` using PostgreSQL dialect
- ESLint 9 uses Next.js `core-web-vitals` + `next/typescript`
- `eslint-config-prettier` keeps lint rules from fighting Prettier

## File Map

```
app/
  (auth)/login/         # Login page (public)
  api/
    auth/login/         # POST — authenticate_user(), create session
    auth/logout/        # POST — revoke session
    auth/heartbeat/     # POST — touch session last_seen_at
    expenses/           # POST — create branch/employee expense; [id]/ edit/delete
    expense-categories/ # POST create; [id]/ PATCH (edit/deactivate/restore)
    inventory/          # POST create; [id]/ GET item+vendors, PATCH (update/archive/restore/toggle-active/adjust-stock)
    inventory-pricing/  # POST create; [id]/ GET detail, PATCH (update/close)
    customers/          # POST create; [id]/ GET detail, PATCH (update/deactivate/restore)
    users/              # POST create; [id]/ PATCH (edit/deactivate/lock/reset-password)
  dashboard/            # Protected dashboard pages (Server Components)
    customers/          # Customer list page
    customers/new/      # Add Customer page
    inventory/          # Inventory list page
    inventory/new/      # Add Item page
    inventory/[id]/edit/ # Edit Item page
    inventory/pricing/  # Inventory Pricing list page
    inventory/pricing/new/ # Add Pricing page
    expenses/categories/ # Expense Categories list page
    expenses/categories/new/ # Add Expense Category page
  globals.css           # Tailwind 4 import + CSS variable tokens (light + dark)

components/
  auth/                 # LoginForm, LogoutButton
  customers/            # customer-form.tsx, customer-edit-dialog.tsx
  dashboard/            # Shell, header, sidebar, data tables, list controls
  expense-categories/   # expense-category-form.tsx, expense-category-edit-dialog.tsx
  expenses/             # Expense form fields, edit/delete dialogs
  inventory/            # inventory-form.tsx, edit-inventory-form.tsx, edit-inventory-dialog.tsx, adjust-stock-dialog.tsx, inventory-table-with-actions.tsx
  inventory-pricing/    # inventory-pricing-form.tsx, inventory-pricing-dialog.tsx, inventory-pricing-data-table.tsx, inventory-pricing-table-with-actions.tsx
  providers/            # GlobalUiProvider
  ui/                   # Button, Input, Select, Textarea, Spinner, GlobalLoader, Toast (ToastItem, ToastContainer)

lib/
  auth/
    session.ts          # JWT sign/verify, cookie helpers (jose)
    current-user.ts     # DB session lookup + touch (server-only)
    permissions.ts      # Permission union, ROLE_PERMISSIONS map, hasPermission, assertPermission, PermissionError, canAccessBranch
  db/
    postgres.ts         # Singleton pg.Pool (server-only, globalThis cache)
  customers/
    schema.ts / types.ts / queries.ts / mutations.ts
  dashboard/
    queries.ts          # All dashboard DB queries (server-only, parameterized SQL)
    types.ts            # Shared row types
    *-page-filters.ts   # Filter/sort state parsers per page
    href-utils.ts       # normalizeHref, isSameHref
    filter-utils.ts     # normalizeAmountRange
    list-page-classes.ts        # TABLE_HEADER_CELL_CLASS, TABLE_BODY_CELL_CLASS, FILTER_FIELD_LABEL_CLASS
    sortable-header-utils.ts    # getSortDirection, getNextSortValue, HeaderSortConfig<T>
    sticky-column-utils.ts      # ColumnStickyDef, StickySpec, computeStickySpecs, sticky cell helpers
  expense-categories/
    schema.ts / types.ts / queries.ts / mutations.ts
  expenses/
    schema.ts           # Zod discriminated union for expense creation
    types.ts / queries.ts / mutations.ts
  inventory/
    schema.ts           # Zod schemas for inventory create / update / adjust-stock
    types.ts / queries.ts / mutations.ts
  inventory-pricing/
    schema.ts / types.ts / mutations.ts
  users/
    role-rules.ts       # requiresBranch(role) — single source of truth for branch requirement
    mutations.ts        # createUser, updateUser, updateUserStatus, toggleUserLock, resetUserPassword
    queries.ts / schema.ts / types.ts
  validations/
    auth.ts             # loginSchema
    dashboard.ts        # branchFilterSchema
  ui/                   # GlobalLoaderContext, ToastContext (ToastProvider, useToast), client-preferences
  theme/                # ThemeContext
  utils/                # cn(), format()

db/
  migrations/           # SQL migration files — baseline, expense schema hardening, expense/user audit logs,
                        # inventory_v1 (soft-delete, audit logs, stock movements),
                        # expense_categories_management, expense_category_audit_logs,
                        # inventory_pricing_audit_logs, customer_management
  seeds/dev_seed.sql
  reset/dev_reset.sql

scripts/db/             # Node ESM migration tooling (.mjs); repair-checksums.mjs patches schema_migrations checksums after file reformatting
middleware.ts           # Protects /dashboard/*, redirects /login if already authed
```

## Commands

```bash
npm run dev / build / start
npm run typecheck
npm run lint
npm run lint:fix
npm run format:check
npm run format

# DB — always run npm run db:target first to confirm env
npm run db:target
npm run db:new -- <name>           # timestamped migration template
npm run db:migrate -- --dry-run    # preview
npm run db:migrate                 # apply
npm run db:rollback -- --dry-run
npm run db:rollback
npm run db:dump                    # schema-only pg_dump
npm run db:seed:dev -- --confirm printflow_dev
npm run db:reset:dev -- --confirm printflow_dev
```

**`--` is required:** `npm run db:reset:dev -- --confirm printflow_dev` ✅ (without `--`, flag is silently ignored ❌)

## DB Workflow

- Migrations in `db/migrations/` use `-- migrate:up` / `-- migrate:down` blocks
- Applied migrations tracked in `schema_migrations`; checksums validated on apply/rollback
- Use `npm run db:new -- <name>` for all new migrations. Do not rename existing files
- Do not edit applied migrations without explicit user confirmation
- Run `db:target` before any DB operation. Prefer dry runs before applying
- Production: runs only `db:migrate`. Rollback blocked unless `ALLOW_PRODUCTION_ROLLBACK=true`
- `db/migrations/` is in `.prettierignore` — never reformat applied migration files.
- `db/migrations_dev/` contains the 18 original dev migrations for reference only — do not run them against any schema.

### Destructive commands — all 3 gates required:

1. `ALLOW_DESTRUCTIVE_DB_COMMANDS=true`
2. Connected DB name in `DEV_DB_NAME_ALLOWLIST`
3. `-- --confirm <exact_db_name>` on command line

## Environment Variables

| Variable                                                                            | Purpose                                           |
| ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| `DATABASE_URL`                                                                      | PostgreSQL connection string                      |
| `APP_SECRET`                                                                        | Signs JWT session tokens                          |
| `APP_BASE_URL`                                                                      | Base URL                                          |
| `NODE_ENV`                                                                          | Standard Node env                                 |
| `APP_ENV`                                                                           | Optional; falls back to `NODE_ENV`                |
| `SESSION_COOKIE_NAME`                                                               | Default: `dlms_session`                           |
| `SESSION_MAX_AGE`                                                                   | Default: 604800                                   |
| `ACTIVE_USER_WINDOW_MINUTES`                                                        | Default: 15                                       |
| `ALLOW_DESTRUCTIVE_DB_COMMANDS`                                                     | `"true"` for destructive local/test commands      |
| `ALLOW_PRODUCTION_ROLLBACK`                                                         | `"true"` to allow production rollback             |
| `DEV_DB_NAME_ALLOWLIST`                                                             | Comma-separated DB names for destructive commands |
| `POSTGRES_POOL_MAX` / `POSTGRES_IDLE_TIMEOUT_MS` / `POSTGRES_CONNECTION_TIMEOUT_MS` | Optional pool config                              |
| `LOG_POSTGRES_POOL`                                                                 | `"true"` to log pool init                         |
| `SESSION_TOUCH_INTERVAL_SECONDS`                                                    | Default: 60                                       |

- Read `.env.local.example` for variable names only. Never print `.env` values. Never commit secrets.
- `DATABASE_URL` and `APP_SECRET` are server-side only. Do not modify `.env` files unless explicitly asked.

## DB Schema

**Core tables:** `branches`, `users`, `user_auth`, `app_sessions`, `customers`, `vendors`, `inventory`, `inventory_pricing`, `inventory_audit_logs`, `inventory_pricing_audit_logs`, `inventory_stock_movements`, `orders`, `order_items`, `payments`, `order_vendors`, `offer_items`, `order_offer_items`, `branch_expenses`, `employee_expenses`, `expense_categories`, `expense_category_audit_logs`, `expense_attachments`, `order_sequences`

**Enums:** `user_role` (admin/manager/operator/staff), `order_status`, `payment_mode`, `payment_status`, `inventory_unit`, `customer_type`

**Key DB functions:**

- `authenticate_user(username, password)` → `uuid | null`
- `create_user_with_auth(admin_id, ...)` → `uuid` (admin-only)
- `generate_order_code(branch_id, order_date)` → `text`
- `recalculate_order_financials(order_id)`
- `set_updated_at()` — generic trigger

**Key triggers:**

- `trigger_set_order_code` — auto-generates `order_code` on INSERT to `orders`
- `trg_validate_order_header` — guards immutable fields, branch match, derived field writes
- `trg_apply_order_item_inventory` — deducts/restores inventory on `order_items` changes
- `trg_recalculate_order_after_items` / `_after_payments` / `_after_discount` — keep totals in sync
- `trg_restore_inventory_on_cancel` — restores inventory on cancel
- `trg_validate_payment` — validates branch/user match
- `trg_validate_inventory_pricing` — prevents date range overlaps per branch/item/customer_type
- `set_updated_at` on all timestamped tables

## Auth Rules

- Login: React Hook Form + Zod (`loginSchema` in `lib/validations/auth.ts`)
- Login API validates server-side → `SELECT authenticate_user($1, $2)`
- `authenticate_user` handles account lock (5 failed attempts), inactive check, bcrypt via `pgcrypto`
- On success: JWT signed with `jose` (HS256), stored as HTTP-only cookie
- JWT payload (`SessionPayload`): `sessionId`, `userId`, `role`, `branchId`, `username`
- Session token hash (SHA-256) stored in `app_sessions.session_token_hash`
- `getCurrentUser()` in `lib/auth/current-user.ts` verifies JWT, looks up live session, optionally touches `last_seen_at`
- `middleware.ts` protects `/dashboard/**` and redirects `/login` when session is valid — inspect before changing route protection
- Auth/session code is server-only. Do not expose tokens, hashes, or secrets to client
- `create_user_with_auth` is the DB function for user creation (admin only, enforced in DB)

## RBAC

All permission logic lives in `lib/auth/permissions.ts`. This is the single source of truth — do not inline role checks elsewhere.

**Helpers:**

- `hasPermission(user, permission)` — boolean; use for conditional rendering and non-throwing checks
- `assertPermission(user, permission)` — throws `PermissionError` (`.status === 403`); use in server mutations and API handlers before any DB mutation
- `canAccessBranch(user, branchId)` — data-scope guard (orthogonal to permission grants); admins bypass, all others must match their own `branchId`

**Enforcement pattern:** `getCurrentUser()` → `assertPermission()` → DB call

**Forbidden redirect pattern:** Pages that require a permission call `redirect("/dashboard?forbidden=1")` when access is denied. `ForbiddenToast` (rendered inside `DashboardShell`) detects `?forbidden=1` on mount via `window.location.search`, shows a one-shot toast, and removes the param with `window.history.replaceState`. Navigation items and create-menu actions are hidden for roles that lack the required permission — not just disabled.

**Role matrix:**
| Permission | admin | manager | operator | staff |
|---|---|---|---|---|
| `branches:select_all` | ✓ | — | — | — |
| `users:view` | ✓ | ✓ | — | — |
| `users:create` | ✓ | — | — | — |
| `users:edit / deactivate / lock / reset_password` | ✓ | — | — | — |
| `expenses:view` | ✓ | ✓ | ✓ | ✓ |
| `expenses:create / edit` | ✓ | ✓ | ✓ | ✓ |
| `expenses:delete` | ✓ | ✓ | ✓ | — |
| `expense-categories:view` | ✓ | ✓ | ✓ | ✓ |
| `expense-categories:create / edit` | ✓ | ✓ | — | — |
| `expense-categories:deactivate / restore` | ✓ | ✓ | — | — |
| `inventory:view` | ✓ | ✓ | ✓ | ✓ |
| `inventory:create / edit` | ✓ | ✓ | ✓ | — |
| `inventory:archive / restore` | ✓ | ✓ | — | — |
| `customers:view` | ✓ | ✓ | ✓ | ✓ |
| `customers:create / edit` | ✓ | ✓ | ✓ | — |
| `customers:deactivate / restore` | ✓ | ✓ | — | — |

**To add a permission:** (1) add to `Permission` union in `permissions.ts`, (2) grant to appropriate roles in `ROLE_PERMISSIONS`, (3) enforce in the relevant server mutation / API handler / page.

## API Rules

- Route Handlers under `app/api/*`. Set `export const runtime = "nodejs"` for DB access
- Validate all payloads with Zod `safeParse`; return structured field errors on failure
- Authorize before any DB mutation via `getCurrentUser()`
- Return typed minimal JSON: `{ success: boolean, message: string, ... }`
- Catch DB errors; return generic 500 — never leak internal SQL errors to clients
- Parameterized queries only. Never concatenate untrusted input into SQL
- Branch-scope all queries: non-admin restricted to `branchId`; admins query `null` (all branches)
- Derived order fields (`total_amount`, `payable_amount`, `paid_amount`, `payment_status`) are DB-managed — do not set directly

## Inventory Rules

- Use `lib/inventory/schema.ts` for create/update/adjust-stock validation and `lib/inventory/mutations.ts` for all inventory writes.
- Create/update/archive/restore/status changes must enforce RBAC, branch access, and write `inventory_audit_logs`.
- Quantity changes must also write `inventory_stock_movements`; archived items are soft-deleted with `deleted_at`.
- `adjustInventoryStock` in mutations handles the `adjust-stock` PATCH action (logs both audit + stock movement).
- After creating an **active** item, `createInventory` redirects to `/dashboard/inventory/pricing/new?branchId=…&inventoryId=…`; inactive items redirect to `/dashboard/inventory`.
- `canCreatePricing` on the inventory page is derived from `canCreate` (`inventory:create`) — do not call `hasPermission` twice.
- `hasPricing` is a correlated EXISTS subquery in `getInventoryPageData` — true when an active pricing window covers today.
- Stock state uses `COALESCE(i.reorder_level, threshold)` so per-item reorder levels override the global threshold.

## Inventory Pricing Rules

- Use `lib/inventory-pricing/schema.ts` for validation and `lib/inventory-pricing/mutations.ts` for all writes.
- Enforce `assertPermission(user, "inventory:create")` for create, `"inventory:edit"` for update/close — pricing reuses inventory permissions.
- `trg_validate_inventory_pricing` in the DB prevents date range overlaps per branch/item/customer_type — do not check for overlaps in application code.
- `isExpiringSoon` is true when `effective_to` is between today and today + `PRICE_EXPIRING_SOON_DAYS` (7 days). Defined in `lib/dashboard/inventory-pricing-page-filters.ts`.
- The pricing new page reads `inventoryId` from searchParams and passes it as `initialInventoryId` to the form. The form validates the ID against active inventory options before using it as a default.
- All writes must record rows in `inventory_pricing_audit_logs`.

## Customer Management Rules

- Use `lib/customers/schema.ts` for validation and `lib/customers/mutations.ts` for all writes.
- Enforce `assertPermission` + `canAccessBranch` for all customer mutations.
- Deactivate is soft — sets `is_active = false`; restore re-activates. Do not hard-delete customers.

## Order Management Rules

- Add Order lives at `/dashboard/orders/new` and uses `components/orders/order-form.tsx`.
- Order detail at `/dashboard/orders/[id]` separates customer payments (`payments`) from vendor payments (`branch_expenses` linked to `order_vendor_id`).
- Order breadcrumbs follow `Home > Sales > Orders`, including Add/Edit/Detail routes.

## UI Rules

- Use existing components from `components/`. Avoid new UI primitives unless necessary
- Tailwind CSS 4: `@import "tailwindcss"`. Do not use `@tailwind base/components/utilities`
- CSS variable tokens from `app/globals.css`. Reference as `rgb(var(--token))` in inline styles or utilities
- Light (`[data-theme]` default) and dark (`[data-theme="dark"]`) themes defined — maintain dark mode compatibility
- Icons: `lucide-react`
- Forms: React Hook Form + Zod resolver. Follow pattern in `components/auth/login-form.tsx`
- Client components (`"use client"`) only where interactivity requires. Prefer Server Components
- Server Component pages fetch directly via `lib/dashboard/queries.ts`
- Do not import `server-only` modules into client components
- Conditional class merging: `lib/utils/cn.ts`

### Toast system

- `lib/ui/toast-context.tsx` — `ToastProvider`, `useToast()` hook; mirrors `GlobalLoaderContext` pattern
- `components/ui/toast.tsx` — `ToastContainer` (fixed bottom-right, `z-100`) + `ToastItem` (glass card, variant icon)
- `ToastProvider` wraps inside `GlobalUiProvider`; `<ToastContainer />` rendered alongside `<GlobalLoader />`
- `components/dashboard/forbidden-toast.tsx` — one-shot component; reads `window.location.search` directly (not `useSearchParams()`) to detect `?forbidden=1`, calls `showToast`, clears param via `window.history.replaceState`. Uses `[]` dep array so it fires exactly once on mount.
- **Do not use `useSearchParams()`** for one-shot URL-param detection in components rendered from async server component boundaries without an explicit `<Suspense>` wrapper — the hook may return stale/empty values during hydration. Use `window.location.search` instead.

### Dashboard list page conventions

All list pages (orders, customers, inventory, inventory-pricing, employee-expenses, business-expenses, expense-categories, active-users, users) share a common structure:

**Filter controls (`*-list-controls.tsx`)**

- Use `useFilterDrawer` for open/close state, draft filters, pending transition, and focus management
- Render `<FilterDrawerShell>`, `<FilterTriggerButton>`, `<AppliedFilterPills>` — do not re-implement
- `buildAppliedFilterSummaryItems` must always prepend `{ key: "branch", label: "Branch: [name]" }` first, using `selectedBranchName` prop from page
- Filter items that correspond to a value already rendered as a `DataPill` in the table must pass `tone` using the matching helper from `data-pill.tsx` (e.g. `getActiveUserRoleTone`, `getOrderStatusTone`, `getExpenseCategoryTone`). Items with no table-pill equivalent omit `tone` (defaults to neutral).
- `handleApplyFilters` and `handleResetFilters` are page-specific and must stay in the page file

**Data tables (`*-data-table.tsx`)**

- Use `DataTableContainer` (glass card wrapper) and `TableScrollArea` (horizontal scroll with shadow indicators)
- Column definitions use `ColumnStickyDef` mixin (`sticky?: "left" | "right"`, `width?`, `stickyOrder?`). Call `computeStickySpecs(columns)` once; pass result through header map and row render
- Sticky body `<td>`: use `getStickyBodyCellClass` + `getStickyBodyCellStyle`; parent `<tr>` must carry `group` Tailwind class for hover overlay
- Sticky header `<th>`: use `getStickyHeaderCellClass` + `getStickyHeaderCellStyle` (handled inside `SortableHeaderCell` via `stickySpec` prop)
- Pass `stickyLeftWidth={getStickyEdgeTotalWidth(columns, "left") || undefined}` to `<TableScrollArea>` for boundary shadow indicator
- `.table-sticky-body-cell` CSS class in `globals.css` handles opaque background and hover overlay — do not override with Tailwind background utilities on those cells

**Pages**

- Pass `selectedBranchName={context.selectedBranchName}` to every `*ListControls`
- `context.selectedBranchName` is always a non-null string resolved by `getDashboardContext`

### Dashboard overview page (`/dashboard`)

- `DashboardHeader` renders a time-aware greeting when `greetingName` is provided and the current path is `/dashboard`: `Good [morning/afternoon/evening], [FirstName].`
- `greetingBranchName` renders the subtext: `Here's what's happening at [Branch] today.`
- `getGreetingWord()` runs client-side; `suppressHydrationWarning` on the `<h1>` suppresses SSR/client mismatch at hour boundaries
- Pass `greetingName={currentUser.fullName.split(" ")[0] || currentUser.username}` and `greetingBranchName={context.selectedBranchName}` from the page server component

### Top nav conventions (`components/dashboard/top-navbar.tsx`)

- CSS `order` + `flex-wrap` repositions branch selector between breakpoints without duplication
- `md` (768px) is the single breakpoint: two-row (< 768px) → single-row (≥ 768px). Do not change without updating all related breakpoint classes
- Two-row (< 768px): Row 1 = hamburger + brand + actions; Row 2 = BranchFilter full-width (`order-3 w-full`)
- Single-row (≥ 768px): `md:flex-nowrap md:order-2 md:ml-auto` pulls BranchFilter inline
- `NavActionsOverflow` (inline in `top-navbar.tsx`): Theme toggle + Logout in dropdown, `md:hidden` — never visible at ≥ 768px
- Do not add permanent controls to nav without considering all three tiers (mobile, tablet, desktop)

### Create menu conventions (`components/dashboard/create-menu.tsx`)

- Mobile bottom sheet rendered via `createPortal(..., document.body)` — not optional. Nav's `sticky + z-index + backdrop-filter` promotes compositing layer, trapping `position: fixed` children relative to nav box. Without portal, sheet appears near top of screen
- Desktop/mobile threshold: `(min-width: 768px)` matching nav's `md` breakpoint. Below → bottom sheet (portal). At 768px+ → anchored dropdown (absolute, no portal)
- Do not revert `z-[70]` to `z-70` — `z-70` is not a standard Tailwind v4 class
- `onBlurCapture` on wrapper div guarded with `if (!isDesktopViewport) return` — portal content is outside wrapper's DOM subtree, so `wrapperRef.current?.contains(...)` always fails on mobile and would prematurely close the sheet

- Inventory pricing now has dashboard list/create pages, API routes, `lib/inventory-pricing` schemas/mutations/types, overlap-safe DB enforcement, close/update flows, and `inventory_pricing_audit_logs`.
- Expense categories now have dashboard list/create pages, API routes, `lib/expense-categories` logic, active/inactive/restore handling, RBAC permissions, and `expense_category_audit_logs`.
- Vendors now have dashboard list/create pages, API routes, `lib/vendors` logic, edit modal, soft deactivate/restore, RBAC permissions, `vendor_audit_logs`.
- Orders now have Add Order, detail/edit, status, customer payment, vendor assignment/payment, and audit history flows.
- Migrations were consolidated from 18 dev migrations into 7 production migrations (`20260410_000001` – `20260410_000007`). Old files are archived in `db/migrations_dev/` — do not run them.
- Shared dashboard list/table/filter primitives also support the newer inventory pricing and expense category pages.
- Keep using `assertPermission` plus `canAccessBranch` for these flows; inventory pricing reuses inventory create/edit permissions.

### Sidebar navigation (`components/dashboard/dashboard-navigation.tsx`)

- Inventory is a `type: "group"` with two children: Inventory (`/dashboard/inventory`) and Inventory Pricing (`/dashboard/inventory/pricing`).
- Sales is a `type: "group"` with listing children only: Orders, Customers, and Offers.
- Vendors is a listing link only.
- No add-action links in the sidebar — creation is always via the top-nav Create menu or page-level Add buttons.
- `getDashboardBreadcrumbs` has explicit entries for all `/new` routes and nested pages; add a new entry when adding a new creation page.

## Development Rules

- Inspect relevant files before editing
- Make minimal, targeted changes. Preserve existing naming and structure
- Avoid broad refactors unless explicitly requested
- Do not introduce dependencies without explicit approval
- Do not invent scripts, folders, API routes, env vars, or DB objects
- Prefer existing utilities, types, and components
- TypeScript strict. Avoid `any` unless unavoidable and justified
- `lib/db/postgres.ts` and `lib/auth/current-user.ts` are `server-only` — do not import from client components
- Validate after edits: `npm run format:check`, `npm run lint`, `npm run typecheck`; run `npm run build` for broader app changes
- Use `npm run format` only when intentionally formatting touched files or doing a formatting-only pass

## Safety Rules

- Never run `db:reset:dev` or `db:seed:dev` unless explicitly requested and all 3 gates confirmed
- Never edit applied migrations without explicit confirmation
- Never run production rollback without explicit confirmation and `ALLOW_PRODUCTION_ROLLBACK=true`
- Never print or log `.env` values, session tokens, or password hashes
- Never concatenate untrusted input into SQL
- Never expose `lib/db/postgres.ts` or session internals to client code
- Do not add ORMs, Redux, Zustand, TanStack Query, SWR, or other state libraries without explicit approval

## Do Not

- Introduce an ORM or global state library
- Compute pricing or order totals in application code — use the DB
- Manually set `order_code`, `total_amount`, `payable_amount`, `paid_amount`, or `payment_status` in INSERT/UPDATE — DB-managed
- Rename or edit applied migration files
- Run destructive DB commands without explicit request + confirmation
- Leak SQL errors to API clients
- Import server-only modules into client components
- Make broad component rewrites or add premature abstractions
- Claim scripts, files, or DB objects exist unless verified in the repository

## Post-Task Format

After completing a task, summarize:

- **Files changed** (paths)
- **Commands run** and outcomes
- **Commands not run** and why
- **DB commands run**, if any
- **Migration impact**, if any
- **Risks or follow-up actions**, if any
