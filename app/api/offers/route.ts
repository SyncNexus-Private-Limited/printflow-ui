import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getCustomerTypeValues } from "@/lib/customers/queries";
import { getDashboardContext } from "@/lib/dashboard/queries";
import { parseOffersPageFilters } from "@/lib/dashboard/offers-page-filters";
import { OfferMutationError, createOffer } from "@/lib/offers/mutations";
import { getOffersPageData } from "@/lib/offers/queries";
import { buildOfferSchema, getOfferFieldErrors } from "@/lib/offers/schema";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const currentUser = await getCurrentUser({ touchSession: false });

  if (!currentUser) return getUnauthorizedResponse();
  if (!hasPermission(currentUser, "offers:view")) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseOffersPageFilters(Object.fromEntries(url.searchParams));
  const context = await getDashboardContext(currentUser, filters.branchId ?? undefined);
  const data = await getOffersPageData(context.selectedBranchId, {
    ...filters,
    branchId: context.selectedBranchValue,
  });

  return NextResponse.json({ success: true, data });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) return getUnauthorizedResponse();

  try {
    const body = await request.json();
    const validCustomerTypes = await getCustomerTypeValues();
    const parsed = buildOfferSchema(validCustomerTypes).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please correct the highlighted offer details.",
          fieldErrors: getOfferFieldErrors(parsed.error),
        },
        { status: 400 },
      );
    }

    const result = await createOffer(currentUser, parsed.data);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof OfferMutationError) {
      return NextResponse.json(
        { success: false, message: error.message, fieldErrors: error.fieldErrors },
        { status: error.status },
      );
    }

    console.error("Offer creation failed", error);
    return NextResponse.json(
      { success: false, message: "Unable to create offer right now." },
      { status: 500 },
    );
  }
}
