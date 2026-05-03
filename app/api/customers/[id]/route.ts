import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getCustomerById } from "@/lib/customers/queries";
import {
  CustomerMutationError,
  deactivateCustomer,
  restoreCustomer,
  updateCustomer,
} from "@/lib/customers/mutations";
import { customerSchema, getCustomerFieldErrors } from "@/lib/customers/schema";

export const runtime = "nodejs";

const patchBodySchema = z.object({
  action: z.enum(["update", "deactivate", "restore"]),
});

function getUnauthorizedResponse() {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser({ touchSession: false });

  if (!currentUser) return getUnauthorizedResponse();
  if (!hasPermission(currentUser, "customers:view")) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) {
    return NextResponse.json({ success: false, message: "Customer not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: { customer } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) return getUnauthorizedResponse();

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

    if (parsed.data.action === "deactivate") {
      await deactivateCustomer(currentUser, id);
      return NextResponse.json({ success: true, data: { id } });
    }

    if (parsed.data.action === "restore") {
      await restoreCustomer(currentUser, id);
      return NextResponse.json({ success: true, data: { id } });
    }

    const updateParsed = customerSchema.safeParse(body);

    if (!updateParsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please correct the highlighted fields.",
          fieldErrors: getCustomerFieldErrors(updateParsed.error),
        },
        { status: 400 },
      );
    }

    await updateCustomer(currentUser, id, updateParsed.data);
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    if (error instanceof CustomerMutationError) {
      return NextResponse.json(
        { success: false, message: error.message, fieldErrors: error.fieldErrors },
        { status: error.status },
      );
    }

    console.error("Customer update failed", error);
    return NextResponse.json(
      { success: false, message: "Unable to update customer right now." },
      { status: 500 },
    );
  }
}
