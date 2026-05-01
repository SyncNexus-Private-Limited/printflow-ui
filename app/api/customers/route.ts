import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { CustomerMutationError, createCustomer } from "@/lib/customers/mutations";
import { customerSchema, getCustomerFieldErrors } from "@/lib/customers/schema";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) return getUnauthorizedResponse();
  if (!hasPermission(currentUser, "customers:create")) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = customerSchema.safeParse(body);

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
