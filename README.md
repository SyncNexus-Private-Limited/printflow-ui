# printflow-ui

## Project setup
- Install dependencies:

```bash
npm install
```

- Copy `.env.local.example` to `.env` and fill in the values.
- Start the app:

```bash
npm run dev
```

- Useful local checks:

```bash
npm run typecheck
npm run build
```

## Database overview
- This project uses SQL-first migrations in `db/migrations`.
- Migration files use `-- migrate:up` and `-- migrate:down`.
- Applied migrations are tracked in the `schema_migrations` table.
- A baseline migration already exists in the repo.
- Migration checksums are validated before apply and rollback.

## Environment variables
- `DATABASE_URL`: PostgreSQL connection string used by all DB tooling.
- `APP_ENV`: Optional explicit app environment. Falls back to `NODE_ENV`.
- `ALLOW_DESTRUCTIVE_DB_COMMANDS`: Must be `"true"` to run destructive local/test DB commands.
- `ALLOW_PRODUCTION_ROLLBACK`: Optional override for production rollback. Default behavior is blocked.
- `DEV_DB_NAME_ALLOWLIST`: Comma-separated DB names allowed for destructive commands.
- `APP_SECRET`: App secret used by the application.
- `APP_BASE_URL`: Base URL for the app.
- `NODE_ENV`: Standard Node environment value.
- `SESSION_COOKIE_NAME`: Session cookie name.
- `SESSION_MAX_AGE`: Session lifetime in seconds.
- `ACTIVE_USER_WINDOW_MINUTES`: Active user window in minutes.

## DB commands
- `npm run db:new -- <name>`: Create a timestamped SQL migration template.
- `npm run db:migrate`: Apply pending migrations on `DATABASE_URL`.
- `npm run db:rollback`: Roll back the latest applied migration.
- `npm run db:dump`: Write a schema-only dump with `pg_dump`.
- `npm run db:target`: Print effective environment, current database, and current user.
- `npm run db:seed:dev -- --confirm <db_name>`: Run the local/test seed after destructive safety checks.
- `npm run db:reset:dev -- --confirm <db_name>`: Reset local/test data, reapply migrations, and seed.

## Safe usage rules
- Production should run only `npm run db:migrate`.
- `db:reset:dev` and `db:seed:dev` are local/test only.
- Destructive commands require:
  - `ALLOW_DESTRUCTIVE_DB_COMMANDS=true`
  - the connected DB name to be in `DEV_DB_NAME_ALLOWLIST`
  - `-- --confirm <exact_db_name>`
- Production rollback is blocked by default.

## Common commands
- Run the app:

```bash
npm run dev
```

- Inspect the current DB target:

```bash
npm run db:target
```

- Dry run migrations:

```bash
npm run db:migrate -- --dry-run
```

- Apply migrations:

```bash
npm run db:migrate
```

- Local dev seed:

```bash
npm run db:seed:dev -- --confirm printflow_dev
```

- Local dev reset:

```bash
npm run db:reset:dev -- --confirm printflow_dev
```

- Rollback dry run:

```bash
npm run db:rollback -- --dry-run
```

## Important notes
- `npm run` flags must be passed after `--`.
- Correct:

```bash
npm run db:reset:dev -- --confirm printflow_dev
```

- Incorrect:

```bash
npm run db:reset:dev --confirm printflow_dev
```

## Permissions (RBAC)

Role-based access is defined in `lib/auth/permissions.ts`. Every guarded action has a named `Permission` string; `ROLE_PERMISSIONS` maps each role to a `ReadonlySet<Permission>`.

- Use `hasPermission(user, permission)` for conditional rendering.
- Use `assertPermission(user, permission)` in server mutations and API handlers — throws a structured `PermissionError` (403) on failure.
- Pages that require a permission redirect to `/dashboard?forbidden=1`; the `ForbiddenToast` component in the dashboard shell detects this, shows a toast, and cleans the URL.
- To add a permission: add to the `Permission` union → grant in `ROLE_PERMISSIONS` → enforce in the relevant mutation/handler/page. No other files need changing.

## Toast system

A minimal `ToastProvider` / `useToast()` lives in `lib/ui/toast-context.tsx`, mirroring the `GlobalLoaderContext` pattern. `ToastContainer` (fixed bottom-right) and `ToastItem` (glass card with variant icon) are in `components/ui/toast.tsx`. Both are wired up in `GlobalUiProvider`.

## Dashboard frontend architecture
All six list pages (orders, customers, inventory, employee-expenses, business-expenses, active-users) share a common set of primitives:

**`lib/dashboard/`**
- `href-utils.ts` — `normalizeHref`, `isSameHref`
- `filter-utils.ts` — `normalizeAmountRange`
- `list-page-classes.ts` — `TABLE_HEADER_CELL_CLASS`, `TABLE_BODY_CELL_CLASS`, `FILTER_FIELD_LABEL_CLASS`
- `sortable-header-utils.ts` — generic sort helpers and `HeaderSortConfig<T>`
- `sticky-column-utils.ts` — `ColumnStickyDef`, `StickySpec`, `computeStickySpecs`, sticky cell class/style helpers

**`components/dashboard/`**
- `filter-drawer-shell.tsx` — shared filter drawer overlay, header, and footer
- `use-filter-drawer.ts` — state hook (open/close, draft filters, pending transition, focus management)
- `applied-filter-pills.tsx` — pill row renderer; branch name pill is always first; filter items that match a table `DataPill` value pass a `tone` from the corresponding helper in `data-pill.tsx`
- `filter-trigger-button.tsx` — filter button with active-count badge
- `sortable-header-cell.tsx` — `<th>` with sort arrows and optional sticky spec
- `data-table-container.tsx` — card wrapper with glass effect
- `table-scroll-area.tsx` — horizontal scroll container with right/left shadow indicators
- `table-empty-state.tsx` — empty-state card

Page-specific files keep only: column definitions, `<colgroup>`, row rendering, `buildAppliedFilterSummaryItems`, `handleApplyFilters`, and `handleResetFilters`.

## Dashboard shell top nav

The top nav (`components/dashboard/top-navbar.tsx`) uses a CSS `order` + `flex-wrap` trick to reposition the branch selector between breakpoints without rendering it twice.

**Mobile / sm (< 768px) — two rows:**
- Row 1: hamburger + brand (left) · Create + `NavActionsOverflow` (right)
- Row 2: branch selector (full width)

**md+ (≥ 768px) — single row:**
- hamburger + brand · … auto gap … · branch selector · Create · Theme · Logout

`NavActionsOverflow` is a small dropdown (⋯ button) that surfaces Theme toggle and Logout on screens below `md`. It is `md:hidden` and must not be rendered on larger screens.

The Create menu (`components/dashboard/create-menu.tsx`) uses `createPortal` for its mobile bottom sheet. This is required because the nav's `sticky + z-40 + backdrop-filter` combination can create a compositing layer that traps `position: fixed` children relative to the nav rather than the viewport. The portal renders the sheet at `document.body`, guaranteeing correct bottom-of-screen placement at all times.
