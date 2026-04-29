import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { UserMutationError, resetUserPassword } from "@/lib/users/mutations";

export const runtime = "nodejs";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
  mustResetPassword: z.boolean().optional().default(false),
});

function getUnauthorizedResponse() {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    return getUnauthorizedResponse();
  }

  const { id: targetUserId } = await params;

  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    await resetUserPassword(
      currentUser,
      targetUserId,
      parsed.data.newPassword,
      parsed.data.mustResetPassword,
    );

    return NextResponse.json({ success: true, message: "Password reset successfully." });
  } catch (error) {
    if (error instanceof UserMutationError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }

    console.error("Password reset failed", error);

    return NextResponse.json(
      { success: false, message: "Unable to reset the password right now." },
      { status: 500 },
    );
  }
}
