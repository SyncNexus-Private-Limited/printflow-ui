import { getCurrentUser } from "@/lib/auth/current-user";
import { UserMutationError, createUser } from "@/lib/users/mutations";
import { createUserSchema, getCreateUserFieldErrors, toCreateUserInput } from "@/lib/users/schema";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    return getUnauthorizedResponse();
  }

  try {
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please correct the highlighted fields.",
          fieldErrors: getCreateUserFieldErrors(parsed.error),
        },
        { status: 400 },
      );
    }

    const result = await createUser(currentUser, toCreateUserInput(parsed.data));

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof UserMutationError) {
      return NextResponse.json(
        { success: false, message: error.message, fieldErrors: error.fieldErrors },
        { status: error.status },
      );
    }

    console.error("User account creation failed", error);

    return NextResponse.json(
      { success: false, message: "Unable to create the user account right now." },
      { status: 500 },
    );
  }
}
