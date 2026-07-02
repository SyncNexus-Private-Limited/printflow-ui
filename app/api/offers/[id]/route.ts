import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canAccessBranch, hasPermission } from "@/lib/auth/permissions";
import { getCustomerTypeValues } from "@/lib/customers/queries";
import {
  OfferMutationError,
  deactivateOffer,
  restoreOffer,
  updateOffer,
} from "@/lib/offers/mutations";
import { getOfferById } from "@/lib/offers/queries";
import { buildOfferSchema, getOfferFieldErrors } from "@/lib/offers/schema";

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
  if (!hasPermission(currentUser, "offers:view")) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const offer = await getOfferById(id);

  if (!offer) {
    return NextResponse.json({ success: false, message: "Offer not found." }, { status: 404 });
  }

  if (!canAccessBranch(currentUser, offer.branchId)) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  return NextResponse.json({ success: true, data: { offer } });
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
      await deactivateOffer(currentUser, id);
      return NextResponse.json({ success: true, message: "Offer deactivated." });
    }

    if (parsed.data.action === "restore") {
      await restoreOffer(currentUser, id);
      return NextResponse.json({ success: true, message: "Offer restored." });
    }

    const validCustomerTypes = await getCustomerTypeValues();
    const updateParsed = buildOfferSchema(validCustomerTypes).safeParse(body);

    if (!updateParsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please correct the highlighted offer details.",
          fieldErrors: getOfferFieldErrors(updateParsed.error),
        },
        { status: 400 },
      );
    }

    await updateOffer(currentUser, id, updateParsed.data);
    return NextResponse.json({ success: true, message: "Offer updated." });
  } catch (error) {
    if (error instanceof OfferMutationError) {
      return NextResponse.json(
        { success: false, message: error.message, fieldErrors: error.fieldErrors },
        { status: error.status },
      );
    }

    console.error("Offer update failed", error);
    return NextResponse.json(
      { success: false, message: "Unable to update offer right now." },
      { status: 500 },
    );
  }
}
