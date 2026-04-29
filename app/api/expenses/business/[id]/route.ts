import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  ExpenseMutationError,
  deleteBusinessExpense,
  updateBusinessExpense,
} from "@/lib/expenses/mutations";
import {
  updateBusinessExpenseSchema,
  getUpdateBusinessExpenseFieldErrors,
} from "@/lib/expenses/schema";
import {
  getBusinessExpenseDetail,
  getExpenseCategories,
  getExpenseOrderVendors,
  getExpenseVendors,
} from "@/lib/expenses/queries";

export const runtime = "nodejs";

function unauthorizedResponse() {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

function notFoundResponse() {
  return NextResponse.json({ success: false, message: "Expense not found." }, { status: 404 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) return unauthorizedResponse();

  const { id } = await params;

  try {
    const expense = await getBusinessExpenseDetail(id, currentUser);

    if (!expense) return notFoundResponse();

    const [categories, vendors, orderVendors] = await Promise.all([
      getExpenseCategories("business"),
      getExpenseVendors(expense.branchId),
      getExpenseOrderVendors(expense.branchId),
    ]);

    return NextResponse.json({
      success: true,
      data: { expense, options: { categories, vendors, orderVendors } },
    });
  } catch (error) {
    console.error("Failed to load business expense detail", error);

    return NextResponse.json(
      { success: false, message: "Unable to load expense details right now." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) return unauthorizedResponse();

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateBusinessExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please correct the highlighted expense details.",
          fieldErrors: getUpdateBusinessExpenseFieldErrors(parsed.error),
        },
        { status: 400 },
      );
    }

    await updateBusinessExpense(currentUser, id, parsed.data);

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    if (error instanceof ExpenseMutationError) {
      return NextResponse.json(
        { success: false, message: error.message, fieldErrors: error.fieldErrors },
        { status: error.status },
      );
    }

    console.error("Business expense update failed", error);

    return NextResponse.json(
      { success: false, message: "Unable to update this expense right now." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) return unauthorizedResponse();

  const { id } = await params;

  try {
    await deleteBusinessExpense(currentUser, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ExpenseMutationError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }

    console.error("Business expense delete failed", error);

    return NextResponse.json(
      { success: false, message: "Unable to delete this expense right now." },
      { status: 500 },
    );
  }
}
