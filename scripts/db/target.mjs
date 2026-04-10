/**
 * Prints the current database target for DATABASE_URL.
 */
import { getTargetContext, printTargetMetadata, withClient } from "./lib.mjs";

try {
  await withClient(async (client) => {
    const target = await getTargetContext(client);
    printTargetMetadata(target);
  });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
