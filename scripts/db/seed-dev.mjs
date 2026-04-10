/** Runs the local/test development seed with destructive safety checks. */
import {
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
    commandName: "db:seed:dev",
  });

  await withClient(async (client) => {
    const target = await assertDestructiveCommandAllowed(client, cliFlags, {
      commandName: "db:seed:dev",
      effectiveEnvironment: preflight.effectiveEnvironment,
    });
    printTargetMetadata(target);

    await executeSqlFile(client, "db/seeds/dev_seed.sql");
    console.log("Development seed completed.");
  });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
