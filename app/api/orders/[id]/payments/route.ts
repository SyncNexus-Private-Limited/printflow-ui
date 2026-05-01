import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PermissionError } from "@/lib/auth/permissions";
import { OrderMutationError, addOrderPayment } from "@/lib/orders/mutations";
import { addOrderPaymentSchema } from "@/lib/orders/schema";

export const runtime = "nodejs";

type OrderPaymentRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: OrderPaymentRouteContext) {
  const currentUser = await getCurrentUser({ touchSession: true });
  if (!currentUser) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = addOrderPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid payment." },
        { status: 400 },
      );
    }

    const { id } = await context.params;
    await addOrderPayment(currentUser, id, parsed.data);
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

    console.error("Order payment failed", error);
    return NextResponse.json(
      { success: false, message: "Unable to record payment right now." },
      { status: 500 },
    );
  }
}
