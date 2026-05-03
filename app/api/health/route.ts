import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/postgres";

export const runtime = "nodejs";

export async function GET() {
  const start = Date.now();

  try {
    const db = getPool();
    await db.query("SELECT 1");
    const dbResponseTime = Date.now() - start;

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      db: "ok",
      dbResponseTime,
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        timestamp: new Date().toISOString(),
        db: "error",
      },
      { status: 503 },
    );
  }
}
