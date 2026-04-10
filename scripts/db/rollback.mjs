/** Rolls back the latest applied migration. */
import {
  assertRollbackAllowed,
  getTargetContext,
  parseCliFlags,
  printTargetMetadata,
  rollbackLatestMigration,
  withClient,
} from "./lib.mjs";

const cliFlags = parseCliFlags();

try {
  await withClient(async (client) => {
    const target = await getTargetContext(client);
    printTargetMetadata(target);

    await assertRollbackAllowed(cliFlags, {
      commandName: "db:rollback",
      effectiveEnvironment: target.effectiveEnvironment,
    });

    const rolledBack = await rollbackLatestMigration(client, { dryRun: cliFlags.dryRun });

    if (!rolledBack) {
      console.log("No applied migrations found.");
      return;
    }

    if (cliFlags.dryRun) {
      console.log(`Latest migration ready to roll back: ${rolledBack}`);
      return;
    }

    console.log(`Rolled back migration: ${rolledBack}`);
  });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
