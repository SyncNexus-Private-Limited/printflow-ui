import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCustomerTypeValues } from "@/lib/customers/queries";
import {
  InventoryPricingMutationError,
  createInventoryPricing,
} from "@/lib/inventory-pricing/mutations";
import {
  buildInventoryPricingSchema,
  getInventoryPricingFieldErrors,
} from "@/lib/inventory-pricing/schema";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    return getUnauthorizedResponse();
  }

  try {
    const body = await request.json();
    const validCustomerTypes = await getCustomerTypeValues();
    const parsed = buildInventoryPricingSchema(validCustomerTypes).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please correct the highlighted fields.",
          fieldErrors: getInventoryPricingFieldErrors(parsed.error),
        },
        { status: 400 },
      );
    }

    const result = await createInventoryPricing(currentUser, parsed.data);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof InventoryPricingMutationError) {
      return NextResponse.json(
        { success: false, message: error.message, fieldErrors: error.fieldErrors },
        { status: error.status },
      );
    }

    console.error("Inventory pricing creation failed", error);

    return NextResponse.json(
      { success: false, message: "Unable to create inventory pricing right now." },
      { status: 500 },
    );
  }
}
