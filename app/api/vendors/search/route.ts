import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getPool } from "@/lib/db/postgres";
import type { ExpenseVendorOption } from "@/lib/expenses/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const currentUser = await getCurrentUser({ touchSession: false });

  if (!currentUser) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(currentUser, "vendors:view")) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();

    const db = getPool();
    const { rows } = await db.query<ExpenseVendorOption>(
      `
        SELECT id::text AS id, name
        FROM vendors
        WHERE is_active = true
          AND ($1 = '' OR name ILIKE '%' || $1 || '%')
        ORDER BY name ASC
        LIMIT 10
      `,
      [q],
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("Vendor search failed", error);

    return NextResponse.json(
      { success: false, message: "Unable to search vendors right now." },
      { status: 500 },
    );
  }
}
