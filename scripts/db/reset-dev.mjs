/** Resets a local/test database, reapplies migrations, and seeds it. */
import {
  applyPendingMigrations,
  assertDestructiveCommandAllowed,
  assertDestructiveCommandPreconditions,
  executeSqlFile,
  parseCliFlags,
  printTargetMetadata,
  withClient,
} from "./lib.mjs";

const cliFlags = parseCliFlags();

try {
  const preflight = await assertDestructiveCommandPreconditions({
    commandName: "db:reset:dev",
  });

  await withClient(async (client) => {
    const target = await assertDestructiveCommandAllowed(client, cliFlags, {
      commandName: "db:reset:dev",
      effectiveEnvironment: preflight.effectiveEnvironment,
    });
    printTargetMetadata(target);

    await executeSqlFile(client, "db/reset/dev_reset.sql");

    const migrations = await applyPendingMigrations(client);
    const appliedCount = migrations.applied.length;

    if (appliedCount > 0) {
      console.log(`Applied migrations during reset: ${appliedCount}`);
    }

    await executeSqlFile(client, "db/seeds/dev_seed.sql");
    console.log("Reset, migrate, and seed completed.");
  });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
