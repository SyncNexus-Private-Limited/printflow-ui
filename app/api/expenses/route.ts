import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ExpenseMutationError, createExpense } from "@/lib/expenses/mutations";
import { createExpenseSchema, getCreateExpenseFieldErrors } from "@/lib/expenses/schema";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  return NextResponse.json(
    {
      success: false,
      message: "Unauthorized",
    },
    { status: 401 },
  );
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    return getUnauthorizedResponse();
  }

  try {
    const body = await request.json();
    const parsed = createExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please correct the highlighted expense details.",
          fieldErrors: getCreateExpenseFieldErrors(parsed.error),
        },
        { status: 400 },
      );
    }

    const createdExpense = await createExpense(currentUser, parsed.data);

    return NextResponse.json({
      success: true,
      data: createdExpense,
    });
  } catch (error) {
    if (error instanceof ExpenseMutationError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          fieldErrors: error.fieldErrors,
        },
        { status: error.status },
      );
    }

    console.error("Expense creation failed", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create this expense right now.",
      },
      { status: 500 },
    );
  }
}
