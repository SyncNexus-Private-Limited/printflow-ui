import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { parseVendorsPageFilters } from "@/lib/dashboard/vendors-page-filters";
import { VendorMutationError, createVendor } from "@/lib/vendors/mutations";
import { getVendorsPageData } from "@/lib/vendors/queries";
import { getVendorFieldErrors, vendorSchema } from "@/lib/vendors/schema";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const currentUser = await getCurrentUser({ touchSession: false });

  if (!currentUser) return getUnauthorizedResponse();
  if (!hasPermission(currentUser, "vendors:view")) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseVendorsPageFilters(Object.fromEntries(url.searchParams));
  const data = await getVendorsPageData(filters);

  return NextResponse.json({ success: true, data });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) return getUnauthorizedResponse();

  try {
    const body = await request.json();
    const parsed = vendorSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please correct the highlighted vendor details.",
          fieldErrors: getVendorFieldErrors(parsed.error),
        },
        { status: 400 },
      );
    }

    const result = await createVendor(currentUser, parsed.data);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof VendorMutationError) {
      return NextResponse.json(
        { success: false, message: error.message, fieldErrors: error.fieldErrors },
        { status: error.status },
      );
    }

    console.error("Vendor creation failed", error);
    return NextResponse.json(
      { success: false, message: "Unable to create vendor right now." },
      { status: 500 },
    );
  }
}
