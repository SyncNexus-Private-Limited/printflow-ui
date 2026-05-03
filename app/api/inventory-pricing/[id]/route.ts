import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  InventoryPricingMutationError,
  closeInventoryPricing,
  updateInventoryPricing,
} from "@/lib/inventory-pricing/mutations";
import {
  getInventoryPricingFieldErrors,
  inventoryPricingSchema,
} from "@/lib/inventory-pricing/schema";

export const runtime = "nodejs";

const patchBodySchema = z.object({
  action: z.enum(["update", "close"]),
});

function getUnauthorizedResponse() {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    return getUnauthorizedResponse();
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = patchBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 },
      );
    }

    if (parsed.data.action === "close") {
      await closeInventoryPricing(currentUser, id);
      return NextResponse.json({ success: true, data: { id } });
    }

    const updateParsed = inventoryPricingSchema.safeParse(body);

    if (!updateParsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please correct the highlighted fields.",
          fieldErrors: getInventoryPricingFieldErrors(updateParsed.error),
        },
        { status: 400 },
      );
    }

    await updateInventoryPricing(currentUser, id, updateParsed.data);
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    if (error instanceof InventoryPricingMutationError) {
      return NextResponse.json(
        { success: false, message: error.message, fieldErrors: error.fieldErrors },
        { status: error.status },
      );
    }

    console.error("Inventory pricing update failed", error);

    return NextResponse.json(
      { success: false, message: "Unable to save inventory pricing right now." },
      { status: 500 },
    );
  }
}
