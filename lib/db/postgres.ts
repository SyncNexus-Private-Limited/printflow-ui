import "server-only";
import { URL } from "node:url";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Pool } from "pg";

declare global {
  var __postgresPool: Pool | undefined;
}

const globalForPool = globalThis as typeof globalThis & {
  __postgresPool?: Pool;
};

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getHyperdriveConnectionString(): string | null {
  try {
    const { env } = getCloudflareContext();
    const hyperdrive = (env as { HYPERDRIVE?: { connectionString: string } }).HYPERDRIVE;
    return hyperdrive?.connectionString ?? null;
  } catch {
    return null;
  }
}

function createPool() {
  const hyperdriveConnectionString = getHyperdriveConnectionString();
  const databaseUrl = hyperdriveConnectionString ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const parsedUrl = new URL(databaseUrl);
  const usesSupabaseHost =
    parsedUrl.hostname.endsWith(".supabase.co") ||
    parsedUrl.hostname.endsWith(".pooler.supabase.com");
  const sslMode = parsedUrl.searchParams.get("sslmode");
  const isProduction = process.env.NODE_ENV === "production";

  // Workers are short-lived — keep pool size at 1 when using Hyperdrive

  const max = hyperdriveConnectionString
  ? parsePositiveInt(process.env.POSTGRES_POOL_MAX, 5)
  : parsePositiveInt(process.env.POSTGRES_POOL_MAX, isProduction ? 3 : 10);

  const idleTimeoutMillis = parsePositiveInt(
    process.env.POSTGRES_IDLE_TIMEOUT_MS,
    isProduction ? 5_000 : 10_000,
  );
  const connectionTimeoutMillis = parsePositiveInt(
    process.env.POSTGRES_CONNECTION_TIMEOUT_MS,
    5_000,
  );

  const nextPool = new Pool({
  connectionString: databaseUrl,
  max,
  idleTimeoutMillis,
  connectionTimeoutMillis,
  // Hyperdrive handles SSL — only configure SSL for direct connections
  ssl: hyperdriveConnectionString
    ? undefined
    : usesSupabaseHost || sslMode === "require"
      ? { rejectUnauthorized: false }
      : undefined,
});

  if (process.env.LOG_POSTGRES_POOL === "true") {
    console.info("Initializing PostgreSQL pool", {
      host: parsedUrl.hostname,
      max,
      idleTimeoutMillis,
      connectionTimeoutMillis,
      usingHyperdrive: !!hyperdriveConnectionString,
    });
  }

  nextPool.on("error", (error: Error) => {
    console.error("Unexpected PostgreSQL pool error", error);
  });

  return nextPool;
}

export function getPool() {
  // When using Hyperdrive, don't use the globalThis cache.
  // Hyperdrive manages the actual DB pool — cached pools in Workers
  // accumulate stale connections that cause "timeout exceeded" errors.
  if (getHyperdriveConnectionString()) {
    return createPool();
  }

  if (!globalForPool.__postgresPool) {
    globalForPool.__postgresPool = createPool();
  }

  return globalForPool.__postgresPool;
}

export const pool = new Proxy({} as Pool, {
  get(_target, property, receiver) {
    const instance = getPool();
    const value = Reflect.get(instance, property, receiver);

    return typeof value === "function" ? value.bind(instance) : value;
  },
});
// import "server-only";
// import { URL } from "node:url";
// import { Pool } from "pg";

// declare global {
//   var __postgresPool: Pool | undefined;
// }

// const globalForPool = globalThis as typeof globalThis & {
//   __postgresPool?: Pool;
// };

// function parsePositiveInt(value: string | undefined, fallback: number) {
//   const parsed = Number.parseInt(value ?? "", 10);

//   return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
// }

// function createPool() {
//   const databaseUrl = process.env.DATABASE_URL;

//   if (!databaseUrl) {
//     throw new Error("DATABASE_URL is not configured");
//   }

//   const parsedUrl = new URL(databaseUrl);
//   const usesSupabaseHost =
//     parsedUrl.hostname.endsWith(".supabase.co") ||
//     parsedUrl.hostname.endsWith(".pooler.supabase.com");
//   const sslMode = parsedUrl.searchParams.get("sslmode");
//   const isProduction = process.env.NODE_ENV === "production";
//   const max = parsePositiveInt(process.env.POSTGRES_POOL_MAX, isProduction ? 3 : 10);
//   const idleTimeoutMillis = parsePositiveInt(
//     process.env.POSTGRES_IDLE_TIMEOUT_MS,
//     isProduction ? 5_000 : 10_000,
//   );
//   const connectionTimeoutMillis = parsePositiveInt(
//     process.env.POSTGRES_CONNECTION_TIMEOUT_MS,
//     5_000,
//   );

//   const nextPool = new Pool({
//     connectionString: databaseUrl,
//     max,
//     idleTimeoutMillis,
//     connectionTimeoutMillis,
//     ssl: usesSupabaseHost || sslMode === "require" ? { rejectUnauthorized: false } : undefined,
//   });

//   if (process.env.LOG_POSTGRES_POOL === "true") {
//     console.info("Initializing PostgreSQL pool", {
//       host: parsedUrl.hostname,
//       max,
//       idleTimeoutMillis,
//       connectionTimeoutMillis,
//     });
//   }

//   nextPool.on("error", (error: Error) => {
//     console.error("Unexpected PostgreSQL pool error", error);
//   });

//   return nextPool;
// }

// export function getPool() {
//   if (!globalForPool.__postgresPool) {
//     globalForPool.__postgresPool = createPool();
//   }

//   return globalForPool.__postgresPool;
// }

// export const pool = new Proxy({} as Pool, {
//   get(_target, property, receiver) {
//     const instance = getPool();
//     const value = Reflect.get(instance, property, receiver);

//     return typeof value === "function" ? value.bind(instance) : value;
//   },
// });
