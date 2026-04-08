import "server-only";
import { URL } from "node:url";
import { Pool } from "pg";

declare global {
  var __postgresPool: Pool | undefined;
}

const globalForPool = globalThis as typeof globalThis & {
  __postgresPool?: Pool;
};

function createPool() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const parsedUrl = new URL(databaseUrl);
  const usesSupabaseHost = parsedUrl.hostname.endsWith(".supabase.co");
  const sslMode = parsedUrl.searchParams.get("sslmode");

  const nextPool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
    ssl: usesSupabaseHost || sslMode === "require" ? { rejectUnauthorized: false } : undefined,
  });

  nextPool.on("error", (error: Error) => {
    console.error("Unexpected PostgreSQL pool error", error);
  });

  return nextPool;
}

export function getPool() {
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
