/** Keep in sync with backend/src/orders/checkout.constants.ts */

export const SHIPPING_METHODS = ["pickup", "tbilisi", "regions"] as const;
export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

export const SHIPPING_FEES_CENTS: Record<ShippingMethod, number> = {
  pickup: 0,
  tbilisi: 500,
  regions: 1000,
};

export const SHIPPING_LABELS: Record<ShippingMethod, string> = {
  pickup: "Pickup in Tbilisi",
  tbilisi: "Tbilisi courier",
  regions: "Georgia regions",
};

/**
 * Payment options are NOT listed here.
 *
 * Which methods exist, what they are called and whether each is usable depends
 * on which merchant contracts are configured on the server, so checkout asks
 * `GET /payments/methods` instead. Duplicating that list here is what let the
 * frontend claim card payments were available when nothing could take one.
 */
export type PaymentMethod =
  | "cod"
  | "bank_transfer"
  | "card_tbc"
  | "card_bog";

/**
 * Display-only label for a method already stored on an order.
 *
 * Separate from what checkout offers: this has to render historical values —
 * including `card`, used before the acquirers were split — long after those
 * options stop being selectable. Unknown values fall through to the raw key
 * rather than rendering blank.
 */
export function paymentLabel(method: string | undefined | null): string {
  switch (method) {
    case "cod":
      return "Pay on delivery";
    case "bank_transfer":
      return "Bank transfer";
    case "card_tbc":
      return "Card — TBC Bank";
    case "card_bog":
      return "Card — Bank of Georgia";
    case "card":
      return "Card";
    default:
      return method ?? "—";
  }
}

export function stockForSize(
  product: {
    stock: number;
    stockBySize?: Record<string, number> | null;
    sizes: string[];
  },
  size: string | null,
): number {
  if (product.sizes.length === 0) return product.stock;
  if (!size) return 0;
  return product.stockBySize?.[size] ?? 0;
}
