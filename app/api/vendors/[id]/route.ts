import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import {
  VendorMutationError,
  deactivateVendor,
  restoreVendor,
  updateVendor,
} from "@/lib/vendors/mutations";
import { getVendorById } from "@/lib/vendors/queries";
import { getVendorFieldErrors, vendorSchema } from "@/lib/vendors/schema";

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
  if (!hasPermission(currentUser, "vendors:view")) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const vendor = await getVendorById(id);

  if (!vendor) {
    return NextResponse.json({ success: false, message: "Vendor not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: { vendor } });
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
      await deactivateVendor(currentUser, id);
      return NextResponse.json({ success: true, message: "Vendor deactivated." });
    }

    if (parsed.data.action === "restore") {
      await restoreVendor(currentUser, id);
      return NextResponse.json({ success: true, message: "Vendor restored." });
    }

    const updateParsed = vendorSchema.safeParse(body);

    if (!updateParsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please correct the highlighted vendor details.",
          fieldErrors: getVendorFieldErrors(updateParsed.error),
        },
        { status: 400 },
      );
    }

    await updateVendor(currentUser, id, updateParsed.data);
    return NextResponse.json({ success: true, message: "Vendor updated." });
  } catch (error) {
    if (error instanceof VendorMutationError) {
      return NextResponse.json(
        { success: false, message: error.message, fieldErrors: error.fieldErrors },
        { status: error.status },
      );
    }

    console.error("Vendor update failed", error);
    return NextResponse.json(
      { success: false, message: "Unable to update vendor right now." },
      { status: 500 },
    );
  }
}
