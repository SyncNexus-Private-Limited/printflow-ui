import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import {
  InventoryMutationError,
  adjustInventoryStock,
  archiveInventory,
  restoreInventory,
  toggleInventoryActive,
  updateInventory,
} from "@/lib/inventory/mutations";
import {
  adjustInventoryStockSchema,
  getAdjustInventoryStockFieldErrors,
  getUpdateInventoryFieldErrors,
  updateInventorySchema,
} from "@/lib/inventory/schema";
import { getInventoryById, getVendorOptions } from "@/lib/inventory/queries";

export const runtime = "nodejs";

const patchBodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update") }).merge(updateInventorySchema),
  z.object({ action: z.literal("archive") }),
  z.object({ action: z.literal("restore") }),
  z.object({ action: z.literal("toggle-active"), isActive: z.boolean() }),
  z.object({ action: z.literal("adjust-stock") }).merge(adjustInventoryStockSchema),
]);

function getUnauthorizedResponse() {
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser({ touchSession: false });

  if (!currentUser) {
    return getUnauthorizedResponse();
  }

  if (!hasPermission(currentUser, "inventory:edit")) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  const { id: inventoryId } = await params;

  try {
    const [item, vendorOptions] = await Promise.all([
      getInventoryById(inventoryId),
      getVendorOptions(),
    ]);

    if (!item) {
      return NextResponse.json({ success: false, message: "Item not found." }, { status: 404 });
    }

    if (
      !hasPermission(currentUser, "branches:select_all") &&
      currentUser.branchId !== item.branchId
    ) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: { item, vendorOptions } });
  } catch (error) {
    console.error("Failed to fetch inventory item", error);
    return NextResponse.json(
      { success: false, message: "Unable to load item details right now." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser({ touchSession: true });

  if (!currentUser) {
    return getUnauthorizedResponse();
  }

  const { id: inventoryId } = await params;

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

    if (data.action === "update") {
      const updateParsed = updateInventorySchema.safeParse(data);

      if (!updateParsed.success) {
        return NextResponse.json(
          {
            success: false,
            message: "Please correct the highlighted fields.",
            fieldErrors: getUpdateInventoryFieldErrors(updateParsed.error),
          },
          { status: 400 },
        );
      }

      await updateInventory(currentUser, inventoryId, updateParsed.data);
      return NextResponse.json({ success: true, data: { id: inventoryId } });
    }

    if (data.action === "archive") {
      await archiveInventory(currentUser, inventoryId);
      return NextResponse.json({ success: true, data: { id: inventoryId } });
    }

    if (data.action === "restore") {
      await restoreInventory(currentUser, inventoryId);
      return NextResponse.json({ success: true, data: { id: inventoryId } });
    }

    if (data.action === "toggle-active") {
      await toggleInventoryActive(currentUser, inventoryId, data.isActive);
      return NextResponse.json({ success: true, data: { id: inventoryId } });
    }

    if (data.action === "adjust-stock") {
      const adjustParsed = adjustInventoryStockSchema.safeParse(data);

      if (!adjustParsed.success) {
        return NextResponse.json(
          {
            success: false,
            message: "Please correct the highlighted fields.",
            fieldErrors: getAdjustInventoryStockFieldErrors(adjustParsed.error),
          },
          { status: 400 },
        );
      }

      await adjustInventoryStock(currentUser, inventoryId, adjustParsed.data);
      return NextResponse.json({ success: true, data: { id: inventoryId } });
    }

    return NextResponse.json({ success: false, message: "Unknown action." }, { status: 400 });
  } catch (error) {
    if (error instanceof InventoryMutationError) {
      return NextResponse.json(
        { success: false, message: error.message, fieldErrors: error.fieldErrors },
        { status: error.status },
      );
    }

    console.error("Inventory update failed", error);

    return NextResponse.json(
      { success: false, message: "Unable to save changes right now." },
      { status: 500 },
    );
  }
}
