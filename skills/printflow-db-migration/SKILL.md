---
name: printflow-db-migration
description: Guide for creating, applying, and rolling back PostgreSQL migrations in the printflow-ui codebase. Use this skill whenever a task involves schema changes, new migrations, adding columns, creating tables, modifying enums, or any db:migrate / db:rollback / db:new operation. Trigger on phrases like "add a column", "create a table", "write a migration", "run the migration", "roll back", "schema change", "db change", or any mention of the db/ directory, migration files, or schema_migrations.
---

# PrintFlow DB Migration Skill

This skill guides you through the full lifecycle of a database migration in printflow-ui: scaffolding, writing SQL, validating, applying, and rolling back. Always follow the safety gates — they exist to protect production data.

---

## 0. Sync and confirm target first

Before any DB operation, confirm the user is on the right branch and pointed at the right database:

```bash
git fetch origin
git status
npm run db:target
```

Report the output: environment, database name, and user. If the database name is not in `DEV_DB_NAME_ALLOWLIST` (default: `printflow_dev`, `printflow_test`) and the task involves a destructive command, stop and ask the user to confirm before continuing.

---

## 1. Scaffolding a new migration

Always use the scaffold command — never create migration files manually:

```bash
npm run db:new -- <migration_name>
```

Use a descriptive snake_case name that summarises the change. Examples:
- `add_notes_to_orders`
- `create_vendor_contacts_table`
- `add_payment_mode_enum_value`

This produces a timestamped file in `db/migrations/` with the required markers:

```sql
-- migrate:up

-- Write the forward migration here.

-- migrate:down

-- Write the rollback migration here.
```

Do not rename the file after creation — the timestamp prefix is part of the checksum identity.

---

## 2. Writing the SQL

### If the user describes the change in plain English

Translate it to SQL and fill in both sections. Always write the down section to cleanly undo the up section.

**Common patterns:**

| Intent | Up | Down |
|---|---|---|
| Add nullable column | `ALTER TABLE t ADD COLUMN col type;` | `ALTER TABLE t DROP COLUMN col;` |
| Add NOT NULL with default | `ALTER TABLE t ADD COLUMN col type NOT NULL DEFAULT val;` | `ALTER TABLE t DROP COLUMN col;` |
| Create table | `CREATE TABLE t (...);` | `DROP TABLE t;` |
| Add index | `CREATE INDEX idx_name ON t(col);` | `DROP INDEX idx_name;` |
| Add enum value | `ALTER TYPE enum_name ADD VALUE 'new_val';` | *(see note below)* |
| Rename column | `ALTER TABLE t RENAME COLUMN old TO new;` | `ALTER TABLE t RENAME COLUMN new TO old;` |
| Drop column | `ALTER TABLE t DROP COLUMN col;` | `ALTER TABLE t ADD COLUMN col type;` — restore with original constraints |

> **Enum rollback caveat:** PostgreSQL does not support removing enum values once added. If the down section cannot cleanly undo, write a comment explaining why and what manual steps are needed. Flag this to the user explicitly.

### Rules for all migrations

- Never modify columns that are DB-managed (`order_code`, `total_amount`, `payable_amount`, `paid_amount`, `payment_status`) — these are set by triggers.
- Never disable or drop triggers without explicit user confirmation.
- Financial columns must use `numeric`, not `float`.
- Parameterise any data-backfill SQL — never interpolate raw values.
- If the migration touches `orders`, `order_items`, or `payments`, note the trigger surface in the handoff.
- Keep each migration focused on one logical change.

---

## 3. Validate before applying

Always dry-run first:

```bash
npm run db:migrate -- --dry-run
```

This validates all migration file formats and checksums without touching the database. Fix any errors before proceeding.

---

## 4. Applying the migration

```bash
npm run db:migrate
```

Report what was applied. If already up to date, say so clearly.

**Production note:** `db:migrate` is the only DB command that runs in production. All other commands (`reset`, `seed`, `rollback`) are local/test only.

---

## 5. Rolling back

Always dry-run first:

```bash
npm run db:rollback -- --dry-run
npm run db:rollback
```

Rollback is blocked in production by default. To override, the user must set `ALLOW_PRODUCTION_ROLLBACK=true` and pass `--allow-production`. Do not suggest or enable production rollback unless explicitly asked.

---

## 6. Destructive command gates

`db:reset:dev` and `db:seed:dev` require all three of:

1. `ALLOW_DESTRUCTIVE_DB_COMMANDS=true` in the environment
2. Connected DB name in `DEV_DB_NAME_ALLOWLIST`
3. `-- --confirm <exact_db_name>` on the command line

Never run these without explicit user instruction. If asked to "reset the database" without mentioning these gates, explain the requirements first.

---

## 7. Rules for existing migrations

- Never edit a migration file that has already been applied — the checksum will mismatch and `db:migrate` will error.
- If a mistake is in an applied migration, create a new corrective migration instead.
- Only edit an unapplied migration after confirming with the user.

---

## 8. Handoff format

After completing any migration work, always produce this summary:

```
## Migration Handoff

### File created
- db/migrations/<timestamp>_<name>.sql

### SQL summary
- Up: [one-line description]
- Down: [one-line description]

### Trigger surface (if applicable)
- [Triggers that may fire on affected tables]

### Commands run
- npm run db:new -- <name>            ✅
- npm run db:migrate -- --dry-run     ✅
- npm run db:migrate                  ✅ / ⏳ not run — awaiting user confirmation

### Risks or follow-up
- [Enum rollback caveat, nullable vs NOT NULL, backfill needed, trigger impact, etc.]
```
