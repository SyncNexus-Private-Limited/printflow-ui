import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import {
  UserMutationError,
  updateUser,
  updateUserStatus,
  toggleUserLock,
} from "@/lib/users/mutations";
import { updateUserSchema, getUpdateUserFieldErrors, toUpdateUserInput } from "@/lib/users/schema";
import { getUserById, getUserBranchesForCreation } from "@/lib/users/queries";

export const runtime = "nodejs";

const patchBodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("toggle-status"), isActive: z.boolean() }),
  z.object({ action: z.literal("toggle-lock"), isLocked: z.boolean() }),
  z.object({ action: z.literal("update-profile") }).merge(updateUserSchema),
]);

function getUnauthorizedResponse() {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    return getUnauthorizedResponse();
  }

  if (!hasPermission(currentUser, "users:view")) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const { id: targetUserId } = await params;

  try {
    const [user, branchOptions] = await Promise.all([
      getUserById(targetUserId),
      getUserBranchesForCreation(currentUser),
    ]);

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { user, branchOptions, canSelectBranch: true },
    });
  } catch (error) {
    console.error("Failed to load user for edit", error);
    return NextResponse.json(
      { success: false, message: "Unable to load user details right now." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    return getUnauthorizedResponse();
  }

  const { id: targetUserId } = await params;

  try {
    const body = await request.json();
    const parsed = patchBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 },
      );
    }

    const data = parsed.data;

    if (data.action === "toggle-status") {
      await updateUserStatus(currentUser, targetUserId, data.isActive);
      return NextResponse.json({
        success: true,
        message: data.isActive ? "Account activated." : "Account deactivated.",
      });
    }

    if (data.action === "toggle-lock") {
      await toggleUserLock(currentUser, targetUserId, data.isLocked);
      return NextResponse.json({
        success: true,
        message: data.isLocked ? "Account locked." : "Account unlocked.",
      });
    }

    if (data.action === "update-profile") {
      const parsed = updateUserSchema.safeParse(toUpdateUserInput(data));

      if (!parsed.success) {
        const fieldErrors = getUpdateUserFieldErrors(parsed.error);
        return NextResponse.json(
          { success: false, message: "Please fix the errors below.", fieldErrors },
          { status: 400 },
        );
      }

      await updateUser(currentUser, targetUserId, parsed.data);
      return NextResponse.json({ success: true, message: "Account updated." });
    }

    return NextResponse.json({ success: false, message: "Unknown action." }, { status: 400 });
  } catch (error) {
    if (error instanceof UserMutationError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }

    console.error("User update failed", error);

    return NextResponse.json(
      { success: false, message: "Unable to update the user account right now." },
      { status: 500 },
    );
  }
}
