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
