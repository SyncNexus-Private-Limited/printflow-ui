import { customerTypeLabels, type OfferCustomerType } from "@/lib/offers/types";
import { formatCurrency } from "@/lib/utils/format";

// ─── Item validation ──────────────────────────────────────────────────────────

export type ItemValidationError = {
  rowIndex: number;
  field: "inventoryId" | "quantity";
  message: string;
};

type ItemDraft = {
  inventoryId: string;
  quantity: string;
  unitPrice: string;
};

export function validateOrderItems(items: ItemDraft[]): ItemValidationError[] {
  const errors: ItemValidationError[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (!item.inventoryId) {
      errors.push({ rowIndex: i, field: "inventoryId", message: "Select an inventory item" });
    }
    const qty = Number.parseFloat(item.quantity);
    if (!item.quantity.trim() || !Number.isFinite(qty) || qty <= 0) {
      errors.push({ rowIndex: i, field: "quantity", message: "Quantity is required" });
    }
  }
  return errors;
}

// ─── Offer validation ─────────────────────────────────────────────────────────

export type OfferValidationError = {
  offerId: string;
  offerName: string;
  reason: string;
};

type ValidatableOffer = {
  id: string;
  name: string;
  customerType: OfferCustomerType | null;
  minimumOrderValue: number | null;
};

export function validateOffers(
  offerIds: string[],
  availableOffers: ValidatableOffer[],
  customerType: string,
  subtotal: number,
): OfferValidationError[] {
  const errors: OfferValidationError[] = [];
  for (const id of offerIds) {
    const offer = availableOffers.find((o) => o.id === id);
    if (!offer) continue;
    const reasons: string[] = [];
    if (offer.customerType && offer.customerType !== customerType) {
      reasons.push(`${customerTypeLabels[offer.customerType]} customers only`);
    }
    if (offer.minimumOrderValue !== null && subtotal < offer.minimumOrderValue) {
      reasons.push(
        `min ${formatCurrency(offer.minimumOrderValue)} required (current: ${formatCurrency(subtotal)})`,
      );
    }
    if (reasons.length > 0) {
      errors.push({ offerId: id, offerName: offer.name, reason: reasons.join(" · ") });
    }
  }
  return errors;
}
