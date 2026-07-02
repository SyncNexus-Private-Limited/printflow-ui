import { NextResponse } from "next/server";
import { PermissionError } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCustomerTypeValues } from "@/lib/customers/queries";
import { OrderMutationError, createOrder } from "@/lib/orders/mutations";
import { buildCreateOrderSchema, getCreateOrderFieldErrors } from "@/lib/orders/schema";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) return getUnauthorizedResponse();

  try {
    const body = await request.json();
    const validCustomerTypes = await getCustomerTypeValues();
    const parsed = buildCreateOrderSchema(validCustomerTypes).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please correct the highlighted order details.",
          fieldErrors: getCreateOrderFieldErrors(parsed.error),
        },
        { status: 400 },
      );
    }

    const result = await createOrder(currentUser, parsed.data);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }
    if (error instanceof OrderMutationError) {
      return NextResponse.json(
        { success: false, message: error.message, fieldErrors: error.fieldErrors },
        { status: error.status },
      );
    }

    console.error("Order creation failed", error);
    return NextResponse.json(
      { success: false, message: "Unable to create order right now." },
      { status: 500 },
    );
  }
}
