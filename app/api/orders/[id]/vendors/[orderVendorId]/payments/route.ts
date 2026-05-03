import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PermissionError } from "@/lib/auth/permissions";
import { OrderMutationError, recordOrderVendorPayment } from "@/lib/orders/mutations";
import { recordOrderVendorPaymentSchema } from "@/lib/orders/schema";

export const runtime = "nodejs";

type OrderVendorPaymentRouteContext = {
  params: Promise<{ id: string; orderVendorId: string }>;
};

export async function POST(request: Request, context: OrderVendorPaymentRouteContext) {
  const currentUser = await getCurrentUser({ touchSession: true });
  if (!currentUser) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = recordOrderVendorPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid vendor payment." },
        { status: 400 },
      );
    }

    const { id, orderVendorId } = await context.params;
    await recordOrderVendorPayment(currentUser, id, orderVendorId, parsed.data);
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

    console.error("Order vendor payment failed", error);
    return NextResponse.json(
      { success: false, message: "Unable to record vendor payment right now." },
      { status: 500 },
    );
  }
}
