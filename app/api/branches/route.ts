import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { BranchMutationError, createBranch } from "@/lib/branches/mutations";
import { getBranchesPageData } from "@/lib/branches/queries";
import { getBranchFieldErrors, branchSchema } from "@/lib/branches/schema";
import { parseBranchesPageFilters } from "@/lib/dashboard/branches-page-filters";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const currentUser = await getCurrentUser({ touchSession: false });

  if (!currentUser) return getUnauthorizedResponse();
  if (!hasPermission(currentUser, "branches:view")) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseBranchesPageFilters(Object.fromEntries(url.searchParams));
  const data = await getBranchesPageData(filters);

  return NextResponse.json({ success: true, data });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) return getUnauthorizedResponse();

  try {
    const body = await request.json();
    const parsed = branchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please correct the highlighted branch details.",
          fieldErrors: getBranchFieldErrors(parsed.error),
        },
        { status: 400 },
      );
    }

    const result = await createBranch(currentUser, parsed.data);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof BranchMutationError) {
      return NextResponse.json(
        { success: false, message: error.message, fieldErrors: error.fieldErrors },
        { status: error.status },
      );
    }

    console.error("Branch creation failed", error);
    return NextResponse.json(
      { success: false, message: "Unable to create branch right now." },
      { status: 500 },
    );
  }
}
