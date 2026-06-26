import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PermissionError } from "@/lib/auth/permissions";
import {
  OrderMutationError,
  cancelOrder,
  deleteOrder,
  updateOrder,
  updateOrderStatus,
} from "@/lib/orders/mutations";
import {
  cancelOrderSchema,
  deleteOrderSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
} from "@/lib/orders/schema";

export const runtime = "nodejs";

type OrderRouteContext = {
  params: Promise<{ id: string }>;
};

function getUnauthorizedResponse() {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

function getErrorResponse(error: unknown, fallback: string) {
  if (error instanceof PermissionError) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }
  if (error instanceof OrderMutationError) {
    return NextResponse.json(
      { success: false, message: error.message, fieldErrors: error.fieldErrors },
      { status: error.status },
    );
  }

  console.error(fallback, error);
  return NextResponse.json({ success: false, message: fallback }, { status: 500 });
}

export async function PATCH(request: Request, context: OrderRouteContext) {
  const currentUser = await getCurrentUser({ touchSession: true });
  if (!currentUser) return getUnauthorizedResponse();

  const { id } = await context.params;

  try {
    const body = await request.json();
    const action = typeof body?.action === "string" ? body.action : "update";

    if (action === "status") {
      const parsed = updateOrderStatusSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, message: "Select a valid order status." },
          { status: 400 },
        );
      }
      await updateOrderStatus(currentUser, id, parsed.data);
      return NextResponse.json({ success: true });
    }

    if (action === "cancel") {
      const parsed = cancelOrderSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, message: "Enter a reason and a valid refund decision." },
          { status: 400 },
        );
      }
      await cancelOrder(currentUser, id, parsed.data);
      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      const parsed = deleteOrderSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, message: "Enter a reason and a valid refund decision." },
          { status: 400 },
        );
      }
      await deleteOrder(currentUser, id, parsed.data);
      return NextResponse.json({ success: true });
    }

    const parsed = updateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Please correct the highlighted order details." },
        { status: 400 },
      );
    }

    await updateOrder(currentUser, id, parsed.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return getErrorResponse(error, "Unable to update order right now.");
  }
}
