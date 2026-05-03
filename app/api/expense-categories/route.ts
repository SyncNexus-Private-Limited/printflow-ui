import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getExpenseCategoriesPageData } from "@/lib/expense-categories/queries";
import {
  ExpenseCategoryMutationError,
  createExpenseCategory,
} from "@/lib/expense-categories/mutations";
import {
  expenseCategorySchema,
  getExpenseCategoryFieldErrors,
} from "@/lib/expense-categories/schema";
import { parseExpenseCategoriesPageFilters } from "@/lib/dashboard/expense-categories-page-filters";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const currentUser = await getCurrentUser({ touchSession: false });

  if (!currentUser) return getUnauthorizedResponse();
  if (!hasPermission(currentUser, "expense-categories:view")) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseExpenseCategoriesPageFilters(Object.fromEntries(url.searchParams));
  const data = await getExpenseCategoriesPageData(filters);

  return NextResponse.json({ success: true, data });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) return getUnauthorizedResponse();
  if (!hasPermission(currentUser, "expense-categories:create")) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = expenseCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please correct the highlighted fields.",
          fieldErrors: getExpenseCategoryFieldErrors(parsed.error),
        },
        { status: 400 },
      );
    }

    const result = await createExpenseCategory(currentUser, parsed.data);

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof ExpenseCategoryMutationError) {
      return NextResponse.json(
        { success: false, message: error.message, fieldErrors: error.fieldErrors },
        { status: error.status },
      );
    }

    console.error("Expense category creation failed", error);
    return NextResponse.json(
      { success: false, message: "Unable to create expense category right now." },
      { status: 500 },
    );
  }
}
