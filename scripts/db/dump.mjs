import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { defaultSchemaDumpPath, getDatabaseUrl, repoRoot, resolveRepoPath } from "./lib.mjs";

const targetArg = process.argv[2];
const outputPath = resolveRepoPath(targetArg ?? defaultSchemaDumpPath);

await mkdir(path.dirname(outputPath), { recursive: true });

const databaseUrl = await getDatabaseUrl();

await new Promise((resolve, reject) => {
  const child = spawn(
    "pg_dump",
    [
      "--schema-only",
      "--no-owner",
      "--no-privileges",
      "--file",
      outputPath,
      databaseUrl,
    ],
    {
      cwd: repoRoot,
      stdio: "inherit",
    }
  );

  child.on("error", (error) => {
    if (error.code === "ENOENT") {
      reject(
        new Error("pg_dump was not found. Install PostgreSQL client tools to use db:dump.")
      );
      return;
    }

    reject(error);
  });

  child.on("exit", (code) => {
    if (code === 0) {
      resolve();
      return;
    }

    reject(new Error(`pg_dump exited with code ${code}.`));
  });
});

console.log(path.relative(repoRoot, outputPath));
