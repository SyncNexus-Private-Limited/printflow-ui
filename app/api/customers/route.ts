import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { CustomerMutationError, createCustomer } from "@/lib/customers/mutations";
import { getCustomerTypeValues } from "@/lib/customers/queries";
import { buildCustomerSchema, getCustomerFieldErrors } from "@/lib/customers/schema";
import { getPool } from "@/lib/db/postgres";
import type { OrderCustomerOption } from "@/lib/orders/types";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const currentUser = await getCurrentUser({ touchSession: false });
  if (!currentUser) return getUnauthorizedResponse();
  if (!hasPermission(currentUser, "customers:view")) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();

    const db = getPool();
    const { rows } = await db.query<OrderCustomerOption>(
      `
        SELECT
          c.id::text AS id,
          c.customer_numeric_id AS "customerNumericId",
          c.customer_code AS "customerCode",
          c.type::text AS type,
          c.name,
          c.studio_name AS "studioName",
          c.phone,
          c.alternate_phone AS "alternatePhone",
          c.avatar,
          c.avatar_source AS "avatarSource",
          COALESCE(credits.balance, 0)::double precision AS "creditBalance"
        FROM customers c
        LEFT JOIN LATERAL (
          SELECT SUM(cct.amount) AS balance
          FROM customer_credit_transactions cct
          WHERE cct.customer_id = c.id
        ) credits ON true
        WHERE c.is_active = true
          AND (
            $1 = ''
            OR c.name ILIKE '%' || $1 || '%'
            OR c.phone ILIKE '%' || $1 || '%'
            OR c.customer_code ILIKE '%' || $1 || '%'
            OR c.customer_numeric_id::text ILIKE '%' || $1 || '%'
            OR c.studio_name ILIKE '%' || $1 || '%'
          )
        ORDER BY c.created_at DESC
        LIMIT 10
      `,
      [q],
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("Customer search failed", error);
    return NextResponse.json(
      { success: false, message: "Unable to search customers right now." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) return getUnauthorizedResponse();
  if (!hasPermission(currentUser, "customers:create")) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validTypes = await getCustomerTypeValues();
    const parsed = buildCustomerSchema(validTypes).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please correct the highlighted fields.",
          fieldErrors: getCustomerFieldErrors(parsed.error),
        },
        { status: 400 },
      );
    }

    const result = await createCustomer(currentUser, parsed.data);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof CustomerMutationError) {
      return NextResponse.json(
        { success: false, message: error.message, fieldErrors: error.fieldErrors },
        { status: error.status },
      );
    }

    console.error("Customer creation failed", error);
    return NextResponse.json(
      { success: false, message: "Unable to create customer right now." },
      { status: 500 },
    );
  }
}
