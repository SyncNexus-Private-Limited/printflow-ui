import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { getExpenseCategoryById } from "@/lib/expense-categories/queries";
import {
  ExpenseCategoryMutationError,
  deactivateExpenseCategory,
  restoreExpenseCategory,
  updateExpenseCategory,
} from "@/lib/expense-categories/mutations";
import {
  expenseCategorySchema,
  getExpenseCategoryFieldErrors,
} from "@/lib/expense-categories/schema";

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
  if (!hasPermission(currentUser, "expense-categories:view")) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const category = await getExpenseCategoryById(id);

  if (!category) {
    return NextResponse.json(
      { success: false, message: "Expense category not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: { category } });
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
      await deactivateExpenseCategory(currentUser, id);
      return NextResponse.json({ success: true, message: "Category deactivated." });
    }

    if (parsed.data.action === "restore") {
      await restoreExpenseCategory(currentUser, id);
      return NextResponse.json({ success: true, message: "Category restored." });
    }

    const updateParsed = expenseCategorySchema.safeParse(body);

    if (!updateParsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please correct the highlighted fields.",
          fieldErrors: getExpenseCategoryFieldErrors(updateParsed.error),
        },
        { status: 400 },
      );
    }

    await updateExpenseCategory(currentUser, id, updateParsed.data);
    return NextResponse.json({ success: true, message: "Category updated." });
  } catch (error) {
    if (error instanceof ExpenseCategoryMutationError) {
      return NextResponse.json(
        { success: false, message: error.message, fieldErrors: error.fieldErrors },
        { status: error.status },
      );
    }

    console.error("Expense category update failed", error);
    return NextResponse.json(
      { success: false, message: "Unable to update expense category right now." },
      { status: 500 },
    );
  }
}
