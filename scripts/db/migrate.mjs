/** Applies pending migrations or validates them with --dry-run. */
import {
  applyPendingMigrations,
  getTargetContext,
  listMigrationFiles,
  parseCliFlags,
  printTargetMetadata,
  readMigration,
  withClient,
} from "./lib.mjs";

const cliFlags = parseCliFlags();

try {
  if (cliFlags.dryRun) {
    const files = await listMigrationFiles();
    await Promise.all(files.map((filePath) => readMigration(filePath)));

    console.log(`Validated migration files: ${files.length}`);

    for (const filePath of files) {
      console.log(`- ${filePath.split(/[/\\\\]/).pop()}`);
    }

    process.exit(0);
  }

  await withClient(async (client) => {
    const target = await getTargetContext(client);
    printTargetMetadata(target);

    const result = await applyPendingMigrations(client);

    console.log(`Applied migrations: ${result.applied.length}`);

    for (const name of result.applied) {
      console.log(`- ${name}`);
    }

    if (result.skipped.length > 0) {
      console.log(`Already applied: ${result.skipped.length}`);
    }
  });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
