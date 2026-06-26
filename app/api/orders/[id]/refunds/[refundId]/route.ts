import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PermissionError } from "@/lib/auth/permissions";
import { OrderMutationError, updateOrderRefundStatus } from "@/lib/orders/mutations";
import { updateRefundStatusSchema } from "@/lib/orders/schema";

export const runtime = "nodejs";

type OrderRefundRouteContext = {
  params: Promise<{ id: string; refundId: string }>;
};

export async function PATCH(request: Request, context: OrderRefundRouteContext) {
  const currentUser = await getCurrentUser({ touchSession: true });
  if (!currentUser) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateRefundStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Select a valid refund status." },
        { status: 400 },
      );
    }

    const { id, refundId } = await context.params;
    await updateOrderRefundStatus(currentUser, id, refundId, parsed.data);
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

    console.error("Refund status update failed", error);
    return NextResponse.json(
      { success: false, message: "Unable to update refund status right now." },
      { status: 500 },
    );
  }
}
