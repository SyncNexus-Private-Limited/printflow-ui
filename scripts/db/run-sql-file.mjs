/** Executes a SQL file against DATABASE_URL with an explicit purpose. */
import path from "node:path";

import {
  assertDestructiveCommandAllowed,
  assertDestructiveCommandPreconditions,
  executeSqlFile,
  parseCliFlags,
  printTargetMetadata,
  repoRoot,
  resolveRepoPath,
  withClient,
} from "./lib.mjs";

/**
 * Checks whether a dev SQL path requires destructive safety guards.
 * @param {string} filePath
 * @returns {boolean}
 */
function isGuardedDevSqlPath(filePath) {
  const resolvedPath = resolveRepoPath(filePath);
  const relativePath = path.relative(repoRoot, resolvedPath).split(path.sep).join("/");

  return relativePath.startsWith("db/reset/") || relativePath.startsWith("db/seeds/");
}

const cliFlags = parseCliFlags();
const [filePath] = cliFlags.positionals;

try {
  if (!filePath) {
    throw new Error(
      "Usage: node scripts/db/run-sql-file.mjs <path-to-sql> --purpose=<migration|dev> [--no-transaction]"
    );
  }

  if (!cliFlags.purpose) {
    throw new Error(
      "run-sql-file requires an explicit purpose. Use --purpose=migration or --purpose=dev."
    );
  }

  if (!["migration", "dev"].includes(cliFlags.purpose)) {
    throw new Error('Invalid --purpose value. Use --purpose=migration or --purpose=dev.');
  }

  const transaction = !cliFlags.noTransaction;
  const requiresDestructiveGuard =
    cliFlags.purpose === "dev" && isGuardedDevSqlPath(filePath);
  const preflight = requiresDestructiveGuard
    ? await assertDestructiveCommandPreconditions({
        commandName: `run-sql-file ${filePath}`,
      })
    : null;

  await withClient(async (client) => {
    if (requiresDestructiveGuard) {
      const target = await assertDestructiveCommandAllowed(client, cliFlags, {
        commandName: `run-sql-file ${filePath}`,
        effectiveEnvironment: preflight.effectiveEnvironment,
      });
      printTargetMetadata(target);
    }

    await executeSqlFile(client, filePath, { transaction });
    console.log(`Executed ${filePath}`);
  });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
