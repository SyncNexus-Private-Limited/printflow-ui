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
- PostgreSQL is source of truth for all financial totals, inventory counts, order codes, and customer numeric codes

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
    auth/clear/         # POST — clears a stale/invalid session cookie
    expenses/           # POST — create branch/employee expense; business/[id], employee/[id] edit/delete
    expense-categories/ # POST create; [id]/ PATCH (edit/deactivate/restore)
    branches/           # POST create; [id]/ GET detail, PATCH (edit/deactivate/restore)
    inventory/          # POST create; [id]/ GET item+vendors, PATCH (update/archive/restore/toggle-active/adjust-stock)
    inventory-pricing/  # POST create; [id]/ GET detail, PATCH (update/close)
    customers/          # POST create; [id]/ GET detail, PATCH (update/deactivate/restore)
    orders/             # POST create; [id]/ PATCH (update/status/cancel/delete); [id]/payments POST; [id]/refunds/[refundId] PATCH (refund status); [id]/vendors, [id]/vendors/[orderVendorId]/payments
    offers/             # POST create; [id]/ PATCH (edit/deactivate/restore)
    vendors/            # POST create; [id]/ GET detail, PATCH (edit/deactivate/restore); search/ GET — debounced name search for comboboxes
    users/              # POST create; [id]/ PATCH (edit/deactivate/lock/reset-password)
  dashboard/            # Protected dashboard pages (Server Components)
    customers/          # Customer list page
    customers/new/      # Add Customer page
    customers/[id]/     # Customer detail page (metrics, refunds/credits, audit history)
    branches/           # Branch list page
    branches/new/       # Add Branch page
    inventory/          # Inventory list page
    inventory/new/      # Add Item page
    inventory/[id]/edit/ # Edit Item page
    inventory/pricing/  # Inventory Pricing list page
    inventory/pricing/new/ # Add Pricing page
    orders/             # Orders list page
    orders/new/         # Add Order page
    orders/[id]/        # Order detail page
    orders/[id]/edit/   # Edit Order page
    offers/             # Offers list page
    offers/new/         # Add Offer page
    vendors/            # Vendors list page
    vendors/new/        # Add Vendor page
    expenses/categories/ # Expense Categories list page
    expenses/categories/new/ # Add Expense Category page
    expenses/new/       # Add Expense page (business/employee)
    employee-expenses/  # Employee expenses list page
    business-expenses/  # Business expenses list page
    users/              # Users list page (admin-only)
    users/new/          # Add User page (admin-only)
    users/[id]/edit/    # Edit User page (admin-only)
    active-users/       # Active sessions list page (admin/manager)
  globals.css           # Tailwind 4 import + CSS variable tokens (light + dark)

components/
  auth/                 # LoginForm, LogoutButton
  branches/             # branch-form.tsx, branch-edit-dialog.tsx
  customers/            # customer-form.tsx, customer-edit-dialog.tsx, customer-detail-actions.tsx
  dashboard/            # Shell, header, sidebar, data tables, list controls
  expense-categories/   # expense-category-form.tsx, expense-category-edit-dialog.tsx
  expenses/             # Expense form fields, edit/delete dialogs
  orders/               # order-form.tsx, order-edit-form.tsx, order-detail-actions.tsx, order-status-dialog.tsx, cancel-order-dialog.tsx, delete-order-dialog.tsx, refund-decision-fields.tsx, refund-status-dialog.tsx, refunds-section.tsx, order-vendor-dialog.tsx, order-vendor-payment-dialog.tsx, add-payment-dialog.tsx
  offers/               # offer-form.tsx, offer-edit-dialog.tsx
  vendors/              # vendor-form.tsx, vendor-edit-dialog.tsx
  users/                # staff-account-form.tsx, edit-user-form.tsx, user-edit-dialog.tsx, user-role-switch.tsx
  inventory/            # inventory-form.tsx, edit-inventory-form.tsx, edit-inventory-dialog.tsx, adjust-stock-dialog.tsx, inventory-table-with-actions.tsx
  inventory-pricing/    # inventory-pricing-form.tsx, inventory-pricing-dialog.tsx, inventory-pricing-data-table.tsx, inventory-pricing-table-with-actions.tsx
  providers/            # GlobalUiProvider
  ui/                   # Button, Input, Select, Textarea, Spinner, GlobalLoader, Toast (ToastItem, ToastContainer), Dialog, ConfirmDialog, RouteLoading, Combobox (generic base), VendorCombobox (server-search), CategoryCombobox (local-filter)

lib/
  auth/
    session.ts          # JWT sign/verify, cookie helpers (jose)
    current-user.ts     # DB session lookup + touch (server-only)
    permissions.ts      # Permission union, ROLE_PERMISSIONS map, hasPermission, assertPermission, PermissionError, canAccessBranch
  db/
    postgres.ts         # Singleton pg.Pool (server-only, globalThis cache)
  customers/
    schema.ts / types.ts / queries.ts / mutations.ts
    types.ts also exports `CustomerTypeOption`; queries.ts also exports `getCustomerTypeOptions` /
    `getCustomerTypeValues` — live, DB-driven customer-type source (see Customer Type Rules)
  branches/
    schema.ts / types.ts / queries.ts / mutations.ts
  orders/
    schema.ts / types.ts / queries.ts / mutations.ts / guards.ts
    refund-calc.ts      # percent/amount clamping + conversion shared by cancel/delete dialogs and the apply-credits field
    form-validation.ts  # Add Order page field-level validation helpers
  offers/
    schema.ts / types.ts / queries.ts / mutations.ts
  vendors/
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
    common-validators.ts # shared field-level Zod validators reused across schemas
  ui/                   # GlobalLoaderContext, ToastContext (ToastProvider, useToast), client-preferences
  theme/                # ThemeContext
  utils/                # cn(), format()

db/
  migrations/           # 7 consolidated production migrations (20260410_000001-000007: foundation,
                        # operational entities, inventory, orders, expenses, audit logs, offers/admin),
                        # plus point migrations added since: add_labs_customer_type, add_vendor_business_name,
                        # offer_customer_types_array, order_cancellation_refunds_credits,
                        # order_cancellation_zero_outstanding, add_cc_customer_type,
                        # backfill_and_drop_customer_code, auto_generate_customer_numeric_id,
                        # allow_customer_numeric_id_edit
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

**Core tables:** `branches`, `branch_audit_logs`, `users`, `user_audit_logs`, `user_auth`, `app_sessions`, `customers`, `customer_audit_logs`, `vendors`, `vendor_audit_logs`, `inventory`, `inventory_pricing`, `inventory_audit_logs`, `inventory_pricing_audit_logs`, `inventory_stock_movements`, `orders`, `order_items`, `order_audit_logs`, `payments`, `order_vendors`, `offers`, `offer_audit_logs`, `order_applied_offers`, `offer_items`, `order_offer_items`, `order_refunds`, `customer_credit_transactions`, `branch_expenses`, `employee_expenses`, `business_expense_audit_logs`, `employee_expense_audit_logs`, `expense_categories`, `expense_category_audit_logs`, `expense_attachments`, `order_sequences`, `customer_sequences`

Note: `offers` (promotional discounts: percentage/flat/buy_x_get_y, targeted via `customer_types`) and `order_applied_offers` are a separate feature from the older `offer_items`/`order_offer_items` (bundled deal items referenced on orders) — both exist and are unrelated.

**Enums:** `user_role` (admin/manager/operator/staff), `order_status`, `payment_mode`, `payment_status`, `refund_status_value` (pending/processing/completed/failed), `inventory_unit`, `customer_type` (studio/amateur/other/employee/lab/CC — `lab` and `CC` each added via a later migration with `ALTER TYPE ... ADD VALUE`; this enum is the live, single source of truth for customer types across the app — see Customer Type Rules)

**Key DB functions:**

- `authenticate_user(username, password)` → `uuid | null`
- `create_user_with_auth(admin_id, ...)` → `uuid` (admin-only)
- `generate_order_code(branch_id, order_date)` → `text`
- `generate_customer_numeric_id()` → `bigint` — atomically increments the single global counter in `customer_sequences` (same `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` idiom as `generate_order_code`, but unscoped since `customers` has no `branch_id`)
- `recalculate_order_financials(order_id)`
- `set_updated_at()` — generic trigger

**Key triggers:**

- `trigger_set_order_code` — auto-generates `order_code` on INSERT to `orders`
- `trg_validate_order_header` — guards immutable fields, branch match, derived field writes
- `trigger_set_customer_numeric_id` — `BEFORE INSERT` on `customers`; auto-generates `customer_numeric_id` via `generate_customer_numeric_id()` and rejects a manually-supplied value. Unlike `order_code`, it does **not** guard UPDATE — `customer_numeric_id` is editable via Edit Customer (see Customer Management Rules)
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
| `branches:view / create / edit / deactivate / restore` | admin only | - | - | - |
| `branches:select_all` | ✓ | — | — | — |
| `users:view` | ✓ | ✓ | — | — |
| `users:create / edit / deactivate / lock / reset_password` | admin only | - | - | - |
| `orders:create / view / add_payment` | ✓ | ✓ | ✓ | ✓ |
| `orders:edit / update_status / cancel / edit_vendor / add_vendor_payment` | ✓ | ✓ | ✓ | — |
| `orders:apply_discount` | ✓ | ✓ | ✓ | — |
| `orders:apply_high_discount` | ✓ | ✓ | — | — |
| `orders:delete` | admin only | - | - | - |
| `expenses:view` | ✓ | ✓ | ✓ | ✓ |
| `expenses:create / edit` | ✓ | ✓ | ✓ | ✓ |
| `expenses:delete` | ✓ | ✓ | ✓ | — |
| `expense-categories:view` | ✓ | ✓ | ✓ | ✓ |
| `expense-categories:create / edit` | ✓ | ✓ | — | — |
| `expense-categories:deactivate / restore` | ✓ | ✓ | — | — |
| `vendors:view` | ✓ | ✓ | ✓ | ✓ |
| `vendors:create / edit / deactivate / restore` | ✓ | ✓ | — | — |
| `offers:view` | ✓ | ✓ | ✓ | ✓ |
| `offers:create / edit / deactivate / restore` | ✓ | ✓ | — | — |
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
- `customer_type` enum values are DB-driven, not hardcoded in TypeScript — see Customer Type Rules below.
- `customer-data-table.tsx` includes a sortable numeric ID column (`customer_numeric_id`); list/search also matches on `customer_numeric_id::text` and `studio_name` alongside name/phone (`/api/customers` route, `lib/dashboard/customer-page-filters.ts`). There is no `customer_code` column — it was removed; `customer_numeric_id` is the sole customer identifier.
- The Add Order page (`order-form.tsx`) reuses the same customer search (debounced, hits `/api/customers?q=`) to find/prefill a customer when creating an order — do not duplicate the matching logic.

### `customer_numeric_id` Rules

- `customer_numeric_id` is `bigint NOT NULL UNIQUE` and is DB-generated on creation — mirrors `order_code`'s pattern (trigger + atomic counter table), but as a single global counter (`customer_sequences`) since `customers` has no `branch_id` to scope by.
- **Add Customer** (`components/customers/customer-form.tsx`): shows a disabled, read-only "Customer numeric code" field (not registered to the form) — the value is assigned automatically after creation. `createCustomer`'s INSERT never supplies the column; `trigger_set_customer_numeric_id` (`BEFORE INSERT`) raises `Manual customer_numeric_id not allowed` if it ever were.
- **Edit Customer** (`components/customers/customer-edit-dialog.tsx`): shows `customer_numeric_id` as an **editable** field, unlike `order_code`. `updateCustomer` (`lib/customers/mutations.ts`) validates it is non-blank, runs an explicit `SELECT ... WHERE customer_numeric_id = $1 AND id <> $2` duplicate pre-check inside the same transaction before saving, and includes the column in the `UPDATE`. The `customers_customer_numeric_id_key` UNIQUE constraint (caught in `handleDbError`) is the concurrency backstop behind the pre-check.
- Place Order → "Create New" customer (`lib/orders/mutations.ts` `resolveCustomer`) also never supplies `customer_numeric_id` on INSERT — new customers created from that flow get an auto-assigned value the same way Add Customer does.

## Customer Type Rules

`customer_type` is a Postgres enum (`studio`/`amateur`/`other`/`employee`/`lab`/`CC`, extendable via `ALTER TYPE ... ADD VALUE`) and is **read live from the DB at request time** — there is no hardcoded TypeScript array or label map for it anywhere in the app. Adding a new customer type requires only a migration; no application code changes.

- **Single source of truth:** `getCustomerTypeOptions()` in `lib/customers/queries.ts` (`server-only`) queries `pg_enum`/`pg_type` for `customer_type` and returns `{ value, label }[]`, using `formatEnumLabel()` (`lib/utils/format.ts`) to derive the display label from the raw enum value. `getCustomerTypeValues()` is a convenience wrapper returning just the value strings. `CustomerTypeOption` is defined once in `lib/customers/types.ts` and imported wherever needed (orders, offers, inventory-pricing types).
- **Server Component pages** call `getCustomerTypeOptions()` directly and pass the result down as a `customerTypeOptions` prop — same pattern as `branchOptions`/`getDashboardContext`. Every page/dialog that renders a customer-type `<select>`, filter dropdown, or multi-select chips receives this prop; there are no hardcoded `<option>` lists.
- **Client-side Zod validation** (`customerSchema`, `offerSchema`, `inventoryPricingSchema`) is built via factory functions — `buildCustomerSchema(validTypes)`, `buildOfferSchema(validCustomerTypes)`, `buildInventoryPricingSchema(validCustomerTypes)` in the respective `lib/*/schema.ts` — parameterized by the live values list. Forms build the schema with `useMemo(() => buildXSchema(customerTypeOptions.map(o => o.value)), [customerTypeOptions])` before passing it to `zodResolver`. `lib/orders/schema.ts`'s `buildCreateOrderSchema(validCustomerTypes)` is server-only (order forms have no `zodResolver`; validation is via server-returned `fieldErrors`).
- **API routes** (`app/api/customers`, `app/api/offers`, `app/api/inventory-pricing`, `app/api/orders`) fetch `getCustomerTypeValues()` fresh per request, then call the matching `buildXSchema(validTypes)` before `.safeParse(body)`.
- Because the type list is resolved at runtime, `OfferCustomerType`/`CustomerType`/`InventoryPricingCustomerType` are plain `string`, not TS literal unions — exhaustive `Record<CustomerType, X>` lookups are not type-safe. Use a switch/default fallback function instead (e.g. `getCustomerTypeTone` and `getCustomerTypeBadgeClasses` in `components/dashboard/data-pill.tsx`), never a `Record` keyed by customer type.
- To add a new customer type: create a migration with `ALTER TYPE customer_type ADD VALUE IF NOT EXISTS '<value>';` (no down path — Postgres cannot remove enum values), mirroring `db/migrations/20260614_193736_add_labs_customer_type.sql` / `20260702_130429_add_cc_customer_type.sql`. No TypeScript changes are needed.

## Vendor Management Rules

- `/dashboard/vendors` lists vendors with create, edit, deactivate, and restore actions; admin/manager can mutate, all roles can view (`vendors:view`).
- Use `lib/vendors/schema.ts` for validation and `lib/vendors/mutations.ts` for all writes. All writes are audited in `vendor_audit_logs`.
- Vendors have a `businessName` field alongside `name` (`lib/vendors/types.ts`); both are searchable.
- `components/ui/vendor-combobox.tsx` wraps the generic `Combobox` (see UI Rules → Combobox pattern) for server-side debounced (300ms) vendor search against `GET /api/vendors/search?q=`, gated by `vendors:view`. Used wherever a form needs to pick a vendor (e.g. expense forms) instead of a plain `<Select>`.

## Offers Management Rules

- `/dashboard/offers` lists offers with create, edit, deactivate, and restore actions; admin/manager can mutate, all roles can view (`offers:view`).
- Use `lib/offers/schema.ts` for validation and `lib/offers/mutations.ts` for all writes. All writes are audited in `offer_audit_logs`.
- `offerTypeValues`: `percentage`, `flat`, `buy_x_get_y` (`lib/offers/types.ts`).
- An offer can target multiple customer types via `customerTypes: string[]` (multi-select chips in `offer-form.tsx`, built from the live `customerTypeOptions` prop — see Customer Type Rules), stored as the `offers.customer_types` array column (GIN-indexed); `null`/empty means "all customer types". Redemptions are tracked in `order_applied_offers`.

## User Management Rules

- User administration is admin-only: `/dashboard/users`, `/dashboard/users/new`, `/dashboard/users/[id]/edit`, and `/api/users/**`. Admins can also view (not administer) via `users:view` (also granted to manager).
- `/dashboard/active-users` lists live sessions (admin/manager).
- Use `lib/users/schema.ts` for validation and `lib/users/mutations.ts` (`createUser`, `updateUser`, `updateUserStatus`, `toggleUserLock`, `resetUserPassword`) for all writes. All writes are audited in `user_audit_logs`.
- `lib/users/role-rules.ts` → `requiresBranch(role)` is the single source of truth for whether a role must have a `branchId` — do not inline role/branch checks elsewhere.
- User creation goes through the DB function `create_user_with_auth` (admin-only, enforced in DB).

## Branch Management Rules

- Branch management is admin-only: `/dashboard/branches`, `/dashboard/branches/new`, and `/api/branches/**`.
- Use `lib/branches/schema.ts` for validation and `lib/branches/mutations.ts` for all writes.
- Deactivate is soft (`is_active = false`); preserve existing users/orders/inventory/expenses references.
- Navbar Create includes `Add Branch` only when `branches:create` is granted.

## Order Management Rules

- Add Order lives at `/dashboard/orders/new` and uses `components/orders/order-form.tsx`.
- `order-form.tsx` includes a debounced (300ms) customer search (hits `/api/customers?q=`) to find and prefill an existing customer's details when creating an order; field-level validation for the form lives in `lib/orders/form-validation.ts`.
- `/dashboard/orders` has a collapsible, debounced (400ms) Order ID quick-search box beside the "Add Order" button (`order-list-controls.tsx`), bound to the same `orderCode` filter used by the filter drawer's "Order code" field — no separate query path.
- Order detail at `/dashboard/orders/[id]` separates customer payments (`payments`) from vendor payments (`branch_expenses` linked to `order_vendor_id`).
- Order breadcrumbs follow `Home > Sales > Orders`, including Add/Edit/Detail routes.
- Cancel (`orders:cancel`) requires a mandatory free-text reason and a refund decision (amount + mode); `cancelOrder`/`deleteOrder` live in `lib/orders/mutations.ts`, validated by `cancelOrderSchema`/`deleteOrderSchema` in `lib/orders/schema.ts`.
- `refund_mode` reuses the `payment_mode` enum (cash/upi/card/credit/other) — `credit` means the refund is added to the customer's store-credit ledger instead of being paid out physically; there is no separate cash/credit split.
- `trg_restore_inventory_on_cancel` is unchanged and still restores inventory the moment `orders.status` transitions into `'cancelled'`. **Delete** (`orders:delete`, admin-only) is only allowed when `status = 'cancelled'`; it sets `is_deleted = true` without touching `status`, so the trigger never re-fires — inventory is not adjusted a second time.
- Every cancel/delete inserts an `order_refunds` row (`trigger_action`, `reason`, `refund_basis_amount`, `refund_percent`, `refund_amount`, `refund_mode`, `refund_status`). `refund_percent` is always derived server-side from `refund_amount / refund_basis_amount` — the client only ever sends `refund_amount`.
- Refund status (`pending` / `processing` / `completed` / `failed`) is updated via `updateOrderRefundStatus` (reuses `orders:cancel`) through `PATCH /api/orders/[id]/refunds/[refundId]`, logged to `order_audit_logs` as `refund_status_updated`. Cancel/delete are logged as `cancelled`/`deleted`.
- Customer store credit (1 credit = ₹1) is a ledger, not a column: `customer_credit_transactions.amount` is positive for `refund_credit` (issued at cancel/delete) and negative for `applied_to_order` (spent on a new order); balance is always `SUM(amount)` per customer.
- Applying existing credit to a new order is a normal `payments` row with `mode = 'credit'` (reuses `trg_recalculate_order_after_payments` — no new derived-field logic) plus a paired negative `customer_credit_transactions` row. The applied amount is capped at `min(creditBalance, payableAmount)` client-side (`order-form.tsx`) and server-side (`createOrder`, serialized per customer via `pg_advisory_xact_lock(hashtext(customerId))` to prevent concurrent overspend).
- `getOrdersPageData` filters `is_deleted = false` by default — a deleted order disappears from `/dashboard/orders` but stays reachable directly at `/dashboard/orders/[id]` with a "Deleted" pill and `deletionReason` shown.
- Percent/amount sync math used by `cancel-order-dialog.tsx`, `delete-order-dialog.tsx`, and the order-form credits field lives in `lib/orders/refund-calc.ts` (`percentToAmount`, `amountToPercent`, `clampRefundAmount`, `clampRefundPercent`) — reuse it, don't duplicate the clamping inline.
- Customer detail page (`/dashboard/customers/[id]`) shows `creditBalance`, `cancelledOrders`, `totalRefunded`, and `pendingRefundAmount` metrics plus a "Refunds & Credits" section listing recent `order_refunds` and `customer_credit_transactions` rows — sourced from `getCustomerDetailPageData` in `lib/customers/queries.ts`.

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

### Combobox pattern

- `components/ui/combobox.tsx` is the generic base: search input + dropdown list, `getOptionLabel`/`getOptionDescription`, `onQueryChange`, `isLoading`, and a `disableLocalFilter` prop.
- Two flavors built on it:
  - **Server-search** (`components/ui/vendor-combobox.tsx`): sets `disableLocalFilter`, debounces `onQueryChange` (300ms via inline `setTimeout`, no shared debounce hook) and fetches `GET /api/vendors/search?q=`.
  - **Local-filter** (`components/ui/category-combobox.tsx`): no `disableLocalFilter` — filters a pre-fetched options list client-side, no network call per keystroke.
- Pick server-search when the full option set is large/unbounded (vendors); pick local-filter when the page already loaded a small bounded list (expense categories).

### Dashboard list page conventions

All list pages (orders, customers, inventory, inventory-pricing, offers, vendors, employee-expenses, business-expenses, expense-categories, active-users, users, branches) share a common structure:

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
- Vendors now have dashboard list/create pages, API routes, `lib/vendors` logic, edit modal, soft deactivate/restore, RBAC permissions, `vendor_audit_logs`, a `businessName` field, and a debounced server-search `VendorCombobox` (`/api/vendors/search`) reused in expense and order forms.
- Branches now have admin-only dashboard list/create pages, API routes, `lib/branches` logic, edit modal, soft deactivate/restore, RBAC permissions, `branch_audit_logs`.
- Orders now have Add Order (with debounced customer search/prefill), detail/edit, status, customer payment, vendor assignment/payment, and audit history flows, plus an Order ID quick-search box on the list page.
- Orders now also have reasoned cancel/soft-delete with refund tracking (`order_refunds`, independently updatable refund status) and a customer store-credit ledger (`customer_credit_transactions`) that can be issued on refund and spent on a future order, capped at `min(balance, payable)`. `orders:delete` is a new admin-only permission, only usable on already-cancelled orders.
- Offers now have dashboard list/create pages, API routes, `lib/offers` logic, multi-customer-type targeting (`customer_types` array), RBAC permissions, `offer_audit_logs`, and redemption tracking via `order_applied_offers`.
- User management now has admin-only dashboard list/create/edit pages and an Active Users session list, API routes, `lib/users` logic (`role-rules.ts` → `requiresBranch`), RBAC permissions, `user_audit_logs`.
- Customers now have a sortable numeric ID column, a `studio_name` field, and a debounced customer-search combobox reused by the order form.
- `customer_code` has been removed entirely (column, constraint, index, and all app code). `customer_numeric_id` is now the sole customer identifier: DB-generated and NOT NULL (`trigger_set_customer_numeric_id` + `generate_customer_numeric_id()` + `customer_sequences`, mirroring `order_code`'s pattern as a global rather than branch-scoped counter), shown read-only on Add Customer, and editable (with app + DB duplicate validation) on Edit Customer only — see `customer_numeric_id` Rules above.
- Customer type is now a single, live source of truth read from the `customer_type` Postgres enum at request time (`getCustomerTypeOptions`/`getCustomerTypeValues` in `lib/customers/queries.ts`), replacing what used to be 4 duplicated hardcoded TS arrays and ~6 hardcoded `<option>` lists across customers/orders/offers/inventory-pricing — see Customer Type Rules. `lab` and `CC` were both added purely via migration, with zero application code changes required for `CC`.
- Expense forms now use `CategoryCombobox` (local-filter) for category selection and `VendorCombobox` (server-search) for vendor selection, replacing plain `<Select>` elements.
- The 18 original dev migrations were consolidated into 7 production migrations (`20260410_000001` – `20260410_000007`); old files are archived in `db/migrations_dev/` — do not run them. Several point migrations have since been added on top of that baseline (lab customer type, vendor business name, offer customer-types array, order cancellation/refunds/credits) — see `db/migrations/`.
- Shared dashboard list/table/filter primitives also support the newer inventory pricing, expense category, offers, vendors, and user-management pages.
- Keep using `assertPermission` plus `canAccessBranch` for these flows; inventory pricing reuses inventory create/edit permissions.

### Sidebar navigation (`components/dashboard/dashboard-navigation.tsx`)

- Inventory is a `type: "group"` with two children: Inventory (`/dashboard/inventory`) and Inventory Pricing (`/dashboard/inventory/pricing`).
- Sales is a `type: "group"` with listing children only: Orders, Customers, and Offers.
- Expenses is a `type: "group"` with listing children only: Employee Expenses, Business Expenses, and Expense Categories.
- Users is a `type: "group"` with listing children only: Users and Active Users.
- Vendors is a listing link only.
- Branches is an admin-only listing link only.
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
- Manually set `customer_numeric_id` on customer creation (INSERT) — DB-managed via `trigger_set_customer_numeric_id`; it is only ever changed through `updateCustomer`, which duplicate-checks against the database before saving
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
