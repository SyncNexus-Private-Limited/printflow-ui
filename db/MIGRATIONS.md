# Database Migrations

## Format

dbmate — files in `db/migrations/`, format: `-- migrate:up` / `-- migrate:down`

Naming: `YYYYMMDD_HHMMSS_description.sql`

## Commands

```bash
npm run db:target          # Confirm env before any DB operation
npm run db:migrate         # Apply all pending migrations
npm run db:rollback        # Roll back last applied migration
npm run db:new -- <name>   # Create a new timestamped migration file
npm run db:migrate -- --dry-run   # Preview without applying
npm run db:rollback -- --dry-run  # Preview without rolling back
```

## Structure

| File                                       | Domain             | Tables                                                                                                                                                                                                                                  | Notes                                                                                                             |
| ------------------------------------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `20260410_000001_foundation.sql`           | Core               | — (functions only)                                                                                                                                                                                                                      | All 17 PL/pgSQL functions in final state. Extensions + 6 enum types. No tables.                                   |
| `20260410_000002_operational_entities.sql` | Auth / Users       | `branches`, `order_sequences`, `users`, `user_auth`, `app_sessions`, `vendors`, `customers`                                                                                                                                             | Branches FK to users added via ALTER TABLE after users is created. Self-referential users.created_by works in PG. |
| `20260410_000003_inventory.sql`            | Inventory          | `inventory`, `inventory_pricing`, `inventory_stock_movements`                                                                                                                                                                           | Soft-delete via deleted_at. Overlap-safe pricing via DB trigger.                                                  |
| `20260410_000004_orders.sql`               | Orders             | `orders`, `order_items`, `payments`, `order_vendors`, `offer_items`, `order_offer_items`, `order_audit_logs`                                                                                                                            | order_applied_offers is in migration 7 (FK dep on offers). Final order_vendor status values used.                 |
| `20260410_000005_expenses.sql`             | Expenses           | `expense_categories`, `branch_expenses`, `employee_expenses`, `expense_attachments`                                                                                                                                                     | branch_expenses uses `title` (not `name`). No seed data — use API.                                                |
| `20260410_000006_audit_logs.sql`           | Audit              | `vendor_audit_logs`, `customer_audit_logs`, `branch_audit_logs`, `user_audit_logs`, `employee_expense_audit_logs`, `business_expense_audit_logs`, `inventory_audit_logs`, `inventory_pricing_audit_logs`, `expense_category_audit_logs` | offer_audit_logs is in migration 7 (FK dep on offers).                                                            |
| `20260410_000007_offers_and_admin.sql`     | Offers + Bootstrap | `offers`, `order_applied_offers`, `offer_audit_logs` + admin seed                                                                                                                                                                       | order_applied_offers and offer_audit_logs are here because they FK-reference offers.                              |

## Adding New Migrations

1. Run: `npm run db:new -- my_feature_name`
2. Edit the generated file — add `-- migrate:up` and `-- migrate:down` blocks
3. Put ALL related changes in one migration (table + indexes + triggers)
4. Test the full cycle: `db:migrate` → `db:rollback` → `db:migrate`
5. Commit the file (never rename or reformat applied migrations)

## FK Dependency Notes

Two deviations from a purely domain-based split were necessary for FK correctness:

- **`order_applied_offers`** references `offers(id)` → moved from migration 4 to migration 7
- **`offer_audit_logs`** references `offers(id)` → moved from migration 6 to migration 7
- **`order_sequences`** references `branches(id)` → placed in migration 2 (not 1) for the same reason
- **`branches.created_by/updated_by`** FK to `users` is added via `ALTER TABLE` after `users` is created

## Index Strategy

Key indexes beyond standard FK indexes:

| Table                | Index                                                     | Rationale                         |
| -------------------- | --------------------------------------------------------- | --------------------------------- |
| `app_sessions`       | `idx_app_sessions_active` (partial, `is_revoked = false`) | getCurrentUser hot path           |
| `orders`             | `idx_orders_status`, `idx_orders_payment_status`          | List page WHERE filters           |
| `orders`             | `idx_orders_branch_order_date`                            | Composite branch+date filter      |
| `inventory`          | `idx_inventory_active` (partial, `deleted_at IS NULL`)    | All active-item lookups           |
| `inventory`          | `idx_inventory_low_stock`                                 | Stock alert queries               |
| `inventory`          | `idx_inventory_lower_name`                                | Case-insensitive search           |
| `expense_categories` | `idx_expense_categories_active_scope` (partial)           | Category dropdowns                |
| `offers`             | `idx_offers_branch_active_dates` (partial)                | Active-offer lookup in order form |
| `users`              | `idx_users_is_active`                                     | Active-user filters everywhere    |

## First Login Credentials

| Field    | Value      |
| -------- | ---------- |
| Username | `admin`    |
| Password | `admin123` |

> **Change this password immediately after first login via Settings.**

## Archive

`db/migrations_dev/` contains the 18 original development migrations for reference.
They were consolidated into the 7 files above before the first production deployment.
Do not run files from `migrations_dev/` — they contain dev-only data migrations and
legacy backfill logic that will fail on an empty schema.
