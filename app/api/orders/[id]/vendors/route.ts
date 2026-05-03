import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PermissionError } from "@/lib/auth/permissions";
import { OrderMutationError, upsertOrderVendor } from "@/lib/orders/mutations";
import { upsertOrderVendorSchema } from "@/lib/orders/schema";

export const runtime = "nodejs";

type OrderVendorRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: OrderVendorRouteContext) {
  const currentUser = await getCurrentUser({ touchSession: true });
  if (!currentUser) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = upsertOrderVendorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Please correct the vendor details." },
        { status: 400 },
      );
    }

    const { id } = await context.params;
    await upsertOrderVendor(currentUser, id, parsed.data);
    return NextResponse.json({ success: true });
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

    console.error("Order vendor update failed", error);
    return NextResponse.json(
      { success: false, message: "Unable to update vendor details right now." },
      { status: 500 },
    );
  }
}
