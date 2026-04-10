/** Shared helpers for repo-local database scripts. */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_EFFECTIVE_ENV = "development";
const DEFAULT_DEV_DB_NAME_ALLOWLIST = ["printflow_dev", "printflow_test"];

export const repoRoot = path.resolve(__dirname, "..", "..");
export const migrationsDir = path.join(repoRoot, "db", "migrations");
export const defaultSchemaDumpPath = path.join(repoRoot, "db", "schema", "current_schema.sql");

let envLoaded = false;

/**
 * Removes matching wrapping quotes from an env value.
 * @param {string} value
 * @returns {string}
 */
function stripWrappingQuotes(value) {
  if (value.length < 2) {
    return value;
  }

  const first = value[0];
  const last = value[value.length - 1];

  if ((first === "\"" || first === "'") && first === last) {
    return value.slice(1, -1);
  }

  return value;
}

/**
 * Parses a single KEY=value env line.
 * @param {string} line
 * @returns {{ key: string, value: string } | null}
 */
function parseEnvLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

  if (!match) {
    return null;
  }

  const [, key, rawValue] = match;
  return {
    key,
    value: stripWrappingQuotes(rawValue.trim()),
  };
}

/**
 * Loads one env file without overwriting existing process env values.
 * @param {string} filePath
 */
async function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const contents = await readFile(filePath, "utf8");

  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);

    if (!parsed) {
      continue;
    }

    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

/**
 * Parses a comma-separated list with a fallback value.
 * @param {string | undefined} value
 * @param {string[]} fallback
 * @returns {string[]}
 */
function parseList(value, fallback) {
  const normalized = value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!normalized || normalized.length === 0) {
    return [...fallback];
  }

  return normalized;
}

/**
 * Ensures a CLI flag value is present.
 * @param {string} flagName
 * @param {string | undefined} value
 * @param {string} exampleValue
 * @returns {string}
 * @throws {Error} When the flag value is missing.
 */
function requireFlagValue(flagName, value, exampleValue) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flagName} requires a value. Example: ${flagName} ${exampleValue}`);
  }

  return value;
}

/**
 * Checks whether an environment name should be treated as production.
 * @param {string} value
 * @returns {boolean}
 */
function isProductionEnvironment(value) {
  return value.toLowerCase() === "production";
}

/**
 * Loads environment variables from local env files once.
 */
export async function loadEnv() {
  if (envLoaded) {
    return;
  }

  await loadEnvFile(path.join(repoRoot, ".env"));
  await loadEnvFile(path.join(repoRoot, ".env.local"));
  envLoaded = true;
}

/**
 * Resolves the effective app environment.
 * @returns {Promise<string>}
 */
export async function getEffectiveEnvironment() {
  await loadEnv();

  return process.env.APP_ENV?.trim() || process.env.NODE_ENV?.trim() || DEFAULT_EFFECTIVE_ENV;
}

/**
 * Returns the allowlisted DB names for destructive commands.
 * @returns {Promise<string[]>}
 */
export async function getDevDbNameAllowlist() {
  await loadEnv();
  return parseList(process.env.DEV_DB_NAME_ALLOWLIST, DEFAULT_DEV_DB_NAME_ALLOWLIST);
}

/**
 * Resolves the database URL for DB scripts.
 * @param {string | undefined} overrideUrl
 * @returns {Promise<string>}
 * @throws {Error} When DATABASE_URL is missing.
 */
export async function getDatabaseUrl(overrideUrl) {
  await loadEnv();

  const databaseUrl = overrideUrl ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured. Set DATABASE_URL before running database commands."
    );
  }

  return databaseUrl;
}

/**
 * Creates a PostgreSQL client for the configured target.
 * @param {string | undefined} overrideUrl
 * @returns {Promise<import("pg").Client>}
 */
export async function createClient(overrideUrl) {
  const connectionString = await getDatabaseUrl(overrideUrl);
  return new Client({ connectionString });
}

/**
 * Runs a callback with a connected PostgreSQL client.
 * @param {(client: import("pg").Client) => Promise<unknown>} callback
 * @param {string | undefined} overrideUrl
 * @returns {Promise<unknown>}
 */
export async function withClient(callback, overrideUrl) {
  const client = await createClient(overrideUrl);
  await client.connect();

  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

/**
 * Queries the current database name and user.
 * @param {import("pg").Client} client
 * @returns {Promise<{ databaseName: string, currentUser: string }>}
 */
export async function getTargetMetadata(client) {
  const result = await client.query(`
    SELECT
      current_database() AS database_name,
      current_user AS current_user
  `);

  const row = result.rows[0];

  return {
    databaseName: row?.database_name ?? "",
    currentUser: row?.current_user ?? "",
  };
}

/**
 * Combines the effective environment with live DB target metadata.
 * @param {import("pg").Client} client
 * @returns {Promise<{ effectiveEnvironment: string, databaseName: string, currentUser: string }>}
 */
export async function getTargetContext(client) {
  const [effectiveEnvironment, metadata] = await Promise.all([
    getEffectiveEnvironment(),
    getTargetMetadata(client),
  ]);

  return {
    effectiveEnvironment,
    ...metadata,
  };
}

/**
 * Prints the resolved DB target details.
 * @param {{ effectiveEnvironment: string, databaseName: string, currentUser: string }} target
 */
export function printTargetMetadata(target) {
  console.log("DB target:");
  console.log(`- Environment: ${target.effectiveEnvironment}`);
  console.log(`- Database: ${target.databaseName}`);
  console.log(`- User: ${target.currentUser}`);
}

/**
 * Parses supported CLI flags for DB scripts.
 * @param {string[]} [argv]
 * @returns {{
 *   allowProduction: boolean,
 *   confirm: string | null,
 *   dryRun: boolean,
 *   noTransaction: boolean,
 *   positionals: string[],
 *   purpose: string | null,
 *   unknownFlags: string[],
 * }}
 */
export function parseCliFlags(argv = process.argv.slice(2)) {
  const flags = {
    allowProduction: false,
    confirm: null,
    dryRun: false,
    noTransaction: false,
    positionals: [],
    purpose: null,
    unknownFlags: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--allow-production") {
      flags.allowProduction = true;
      continue;
    }

    if (arg === "--dry-run") {
      flags.dryRun = true;
      continue;
    }

    if (arg === "--no-transaction") {
      flags.noTransaction = true;
      continue;
    }

    if (arg === "--confirm") {
      flags.confirm = requireFlagValue("--confirm", argv[index + 1], "printflow_dev");
      index += 1;
      continue;
    }

    if (arg.startsWith("--confirm=")) {
      flags.confirm = requireFlagValue(
        "--confirm",
        arg.slice("--confirm=".length),
        "printflow_dev"
      );
      continue;
    }

    if (arg === "--purpose") {
      flags.purpose = requireFlagValue("--purpose", argv[index + 1], "migration");
      index += 1;
      continue;
    }

    if (arg.startsWith("--purpose=")) {
      flags.purpose = requireFlagValue(
        "--purpose",
        arg.slice("--purpose=".length),
        "migration"
      );
      continue;
    }

    if (arg.startsWith("--")) {
      flags.unknownFlags.push(arg);
      continue;
    }

    flags.positionals.push(arg);
  }

  return flags;
}

/**
 * Verifies that a destructive DB command is allowed for the current target.
 * @param {import("pg").Client} client
 * @param {ReturnType<typeof parseCliFlags>} cliFlags
 * @param {{ commandName?: string, effectiveEnvironment?: string }} [options]
 * @returns {Promise<{ effectiveEnvironment: string, databaseName: string, currentUser: string }>}
 * @throws {Error} When the command is not allowed.
 */
export async function assertDestructiveCommandAllowed(
  client,
  cliFlags,
  { commandName = "This command", effectiveEnvironment } = {}
) {
  const resolvedEnvironment =
    effectiveEnvironment ?? (await getEffectiveEnvironment());

  if (isProductionEnvironment(resolvedEnvironment)) {
    throw new Error(
      `${commandName} is blocked because the effective environment is production. ` +
        "Destructive database commands are not allowed when APP_ENV or NODE_ENV resolves to production."
    );
  }

  await loadEnv();

  if (process.env.ALLOW_DESTRUCTIVE_DB_COMMANDS !== "true") {
    throw new Error(
      `${commandName} is blocked. Set ALLOW_DESTRUCTIVE_DB_COMMANDS=true for local or test work before running destructive database commands.`
    );
  }

  const target = await getTargetMetadata(client);
  const allowlist = await getDevDbNameAllowlist();

  if (!allowlist.includes(target.databaseName)) {
    throw new Error(
      `${commandName} is blocked because the connected database "${target.databaseName}" is not in DEV_DB_NAME_ALLOWLIST (${allowlist.join(
        ", "
      )}).`
    );
  }

  if (!cliFlags.confirm) {
    throw new Error(
      `${commandName} requires explicit confirmation. Re-run the command with '--confirm ${target.databaseName}.'`
    );
  }

  if (cliFlags.confirm !== target.databaseName) {
    throw new Error(
      `${commandName} confirmation mismatch. Connected database is "${target.databaseName}", but --confirm was "${cliFlags.confirm}". Re-run with '--confirm ${target.databaseName}'.`
    );
  }

  return {
    effectiveEnvironment: resolvedEnvironment,
    ...target,
  };
}

/**
 * Blocks destructive commands before opening a DB connection when possible.
 * @param {{ commandName?: string }} [options]
 * @returns {Promise<{ effectiveEnvironment: string }>}
 * @throws {Error} When destructive commands are not allowed.
 */
export async function assertDestructiveCommandPreconditions(
  { commandName = "This command" } = {}
) {
  const effectiveEnvironment = await getEffectiveEnvironment();

  if (isProductionEnvironment(effectiveEnvironment)) {
    throw new Error(
      `${commandName} is blocked because the effective environment is production. ` +
        "Destructive database commands are not allowed when APP_ENV or NODE_ENV resolves to production."
    );
  }

  await loadEnv();

  if (process.env.ALLOW_DESTRUCTIVE_DB_COMMANDS !== "true") {
    throw new Error(
      `${commandName} is blocked. Set ALLOW_DESTRUCTIVE_DB_COMMANDS=true for local or test work before running destructive database commands.`
    );
  }

  return {
    effectiveEnvironment,
  };
}

/**
 * Verifies whether rollback is allowed for the current environment.
 * @param {ReturnType<typeof parseCliFlags>} cliFlags
 * @param {{ commandName?: string, effectiveEnvironment?: string }} [options]
 * @throws {Error} When rollback is blocked.
 */
export async function assertRollbackAllowed(
  cliFlags,
  { commandName = "db:rollback", effectiveEnvironment } = {}
) {
  if (cliFlags.dryRun) {
    return;
  }

  const resolvedEnvironment = effectiveEnvironment ?? (await getEffectiveEnvironment());

  if (!isProductionEnvironment(resolvedEnvironment)) {
    return;
  }

  await loadEnv();

  if (
    process.env.ALLOW_PRODUCTION_ROLLBACK === "true" &&
    cliFlags.allowProduction
  ) {
    return;
  }

  throw new Error(
    `${commandName} is blocked in production. Production should normally use forward-fix migrations instead of routine rollback. To override, set ALLOW_PRODUCTION_ROLLBACK=true and pass --allow-production.`
  );
}

/**
 * Hashes normalized migration contents for checksum tracking.
 * @param {string} contents
 * @returns {string}
 */
export function calculateChecksum(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

/**
 * Splits a migration file into its up and down sections.
 * @param {string} contents
 * @param {string} [fileLabel]
 * @returns {{ normalized: string, upSql: string, downSql: string }}
 * @throws {Error} When the migration format is invalid.
 */
export function parseMigrationSections(contents, fileLabel = "migration") {
  const normalized = contents.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const upMatch = /^--\s*migrate:up\s*$/im.exec(normalized);
  const downMatch = /^--\s*migrate:down\s*$/im.exec(normalized);

  if (!upMatch || !downMatch) {
    throw new Error(`${fileLabel} must contain both "-- migrate:up" and "-- migrate:down" markers.`);
  }

  if (downMatch.index <= upMatch.index) {
    throw new Error(`${fileLabel} has an invalid migration section order.`);
  }

  const upSql = normalized
    .slice(upMatch.index + upMatch[0].length, downMatch.index)
    .trim();
  const downSql = normalized.slice(downMatch.index + downMatch[0].length).trim();

  if (!upSql) {
    throw new Error(`${fileLabel} is missing SQL in the UP section.`);
  }

  if (!downSql) {
    throw new Error(`${fileLabel} is missing SQL in the DOWN section.`);
  }

  return {
    normalized,
    upSql,
    downSql,
  };
}

/**
 * Reads one migration file and computes its checksum.
 * @param {string} filePath
 * @returns {Promise<{ name: string, path: string, checksum: string, upSql: string, downSql: string }>}
 */
export async function readMigration(filePath) {
  const raw = await readFile(filePath, "utf8");
  const { normalized, upSql, downSql } = parseMigrationSections(raw, path.basename(filePath));

  return {
    name: path.basename(filePath),
    path: filePath,
    checksum: calculateChecksum(normalized),
    upSql,
    downSql,
  };
}

/**
 * Lists migration files in sorted execution order.
 * @returns {Promise<string[]>}
 */
export async function listMigrationFiles() {
  const entries = await readdir(migrationsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => path.join(migrationsDir, entry.name))
    .sort((left, right) => path.basename(left).localeCompare(path.basename(right)));
}

/**
 * Creates the schema_migrations table when it does not exist.
 * @param {import("pg").Client} client
 */
export async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

/**
 * Returns applied migrations from schema_migrations.
 * @param {import("pg").Client} client
 * @returns {Promise<Array<{ name: string, checksum: string, applied_at: string }>>}
 */
export async function getAppliedMigrations(client) {
  await ensureMigrationTable(client);

  const result = await client.query(`
    SELECT name, checksum, applied_at
    FROM schema_migrations
    ORDER BY applied_at ASC, name ASC
  `);

  return result.rows;
}

/**
 * Runs raw SQL inside a transaction.
 * @param {import("pg").Client} client
 * @param {string} sql
 * @param {string} description
 * @throws {Error} When the SQL fails.
 */
async function runInTransaction(client, sql, description) {
  await client.query("BEGIN");

  try {
    await client.query(sql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw new Error(`${description} failed: ${error.message}`, { cause: error });
  }
}

/**
 * Applies pending migrations in order.
 * @param {import("pg").Client} client
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<{ skipped: string[], applied: string[] }>}
 * @throws {Error} When a checksum mismatch or migration failure occurs.
 */
export async function applyPendingMigrations(client, { dryRun = false } = {}) {
  const files = await listMigrationFiles();
  const migrations = await Promise.all(files.map((filePath) => readMigration(filePath)));
  const appliedRows = await getAppliedMigrations(client);
  const appliedByName = new Map(appliedRows.map((row) => [row.name, row]));
  const skipped = [];
  const applied = [];

  for (const migration of migrations) {
    const existing = appliedByName.get(migration.name);

    if (existing) {
      if (existing.checksum !== migration.checksum) {
        throw new Error(
          `Applied migration ${migration.name} does not match the current file checksum.`
        );
      }

      skipped.push(migration.name);
      continue;
    }

    applied.push(migration.name);

    if (dryRun) {
      continue;
    }

    await client.query("BEGIN");

    try {
      await client.query(migration.upSql);
      await client.query(
        `
          INSERT INTO schema_migrations (name, checksum)
          VALUES ($1, $2)
        `,
        [migration.name, migration.checksum]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${migration.name} failed: ${error.message}`, {
        cause: error,
      });
    }
  }

  return { skipped, applied };
}

/**
 * Rolls back the latest applied migration.
 * @param {import("pg").Client} client
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<string | null>}
 * @throws {Error} When rollback cannot be performed safely.
 */
export async function rollbackLatestMigration(client, { dryRun = false } = {}) {
  const appliedRows = await getAppliedMigrations(client);
  const latest = appliedRows[appliedRows.length - 1];

  if (!latest) {
    return null;
  }

  const filePath = path.join(migrationsDir, latest.name);

  if (!existsSync(filePath)) {
    throw new Error(`Cannot roll back ${latest.name} because the file is missing from db/migrations.`);
  }

  const migration = await readMigration(filePath);

  if (migration.checksum !== latest.checksum) {
    throw new Error(`Cannot roll back ${latest.name} because the file checksum no longer matches.`);
  }

  if (dryRun) {
    return migration.name;
  }

  await client.query("BEGIN");

  try {
    await client.query(migration.downSql);
    await client.query("DELETE FROM schema_migrations WHERE name = $1", [migration.name]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw new Error(`Rollback ${migration.name} failed: ${error.message}`, { cause: error });
  }

  return migration.name;
}

/**
 * Resolves a path relative to the repo root.
 * @param {string} targetPath
 * @returns {string}
 */
export function resolveRepoPath(targetPath) {
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }

  return path.join(repoRoot, targetPath);
}

/**
 * Executes a SQL file, optionally inside a transaction.
 * @param {import("pg").Client} client
 * @param {string} filePath
 * @param {{ transaction?: boolean }} [options]
 * @returns {Promise<void>}
 */
export async function executeSqlFile(client, filePath, { transaction = true } = {}) {
  const resolvedPath = resolveRepoPath(filePath);
  const sql = (await readFile(resolvedPath, "utf8")).replace(/^\uFEFF/, "").trim();

  if (!sql) {
    return;
  }

  if (!transaction) {
    await client.query(sql);
    return;
  }

  await runInTransaction(client, sql, `Executing ${path.relative(repoRoot, resolvedPath)}`);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

/**
 * Builds a migration timestamp for new filenames.
 * @param {Date} [date]
 * @returns {string}
 */
export function createMigrationTimestamp(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("") + `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * Converts a migration name into a safe filename slug.
 * @param {string} input
 * @returns {string}
 */
export function slugifyMigrationName(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Writes a new file and fails if it already exists.
 * @param {string} filePath
 * @param {string} contents
 * @returns {Promise<void>}
 */
export async function writeNewFile(filePath, contents) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, { flag: "wx" });
}
