/** Creates a new timestamped SQL migration template. */
import path from "node:path";

import {
  createMigrationTimestamp,
  migrationsDir,
  slugifyMigrationName,
  writeNewFile,
} from "./lib.mjs";

const rawName = process.argv.slice(2).join(" ").trim();

if (!rawName) {
  console.error("Usage: npm run db:new -- <migration_name>");
  process.exit(1);
}

const slug = slugifyMigrationName(rawName);

if (!slug) {
  console.error("Migration name must include letters or numbers.");
  process.exit(1);
}

const filename = `${createMigrationTimestamp()}_${slug}.sql`;
const filePath = path.join(migrationsDir, filename);
const template = `-- migrate:up

-- Write the forward migration here.

-- migrate:down

-- Write the rollback migration here.
`;

await writeNewFile(filePath, template);

console.log(path.relative(process.cwd(), filePath));
