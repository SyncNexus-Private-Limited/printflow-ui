import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import {
  BranchMutationError,
  deactivateBranch,
  restoreBranch,
  updateBranch,
} from "@/lib/branches/mutations";
import { getBranchById } from "@/lib/branches/queries";
import { getBranchFieldErrors, branchSchema } from "@/lib/branches/schema";

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
  if (!hasPermission(currentUser, "branches:view")) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;
  const branch = await getBranchById(id);

  if (!branch) {
    return NextResponse.json({ success: false, message: "Branch not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: { branch } });
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
      await deactivateBranch(currentUser, id);
      return NextResponse.json({ success: true, data: { id } });
    }

    if (parsed.data.action === "restore") {
      await restoreBranch(currentUser, id);
      return NextResponse.json({ success: true, data: { id } });
    }

    const updateParsed = branchSchema.safeParse(body);

    if (!updateParsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Please correct the highlighted branch details.",
          fieldErrors: getBranchFieldErrors(updateParsed.error),
        },
        { status: 400 },
      );
    }

    await updateBranch(currentUser, id, updateParsed.data);
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    if (error instanceof BranchMutationError) {
      return NextResponse.json(
        { success: false, message: error.message, fieldErrors: error.fieldErrors },
        { status: error.status },
      );
    }

    console.error("Branch update failed", error);
    return NextResponse.json(
      { success: false, message: "Unable to update branch right now." },
      { status: 500 },
    );
  }
}
