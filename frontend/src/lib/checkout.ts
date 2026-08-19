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

export interface VariantLike {
  size: string;
  stock: number;
  isActive?: boolean;
  priceDeltaCents?: number;
}

/**
 * Mirrors `backend/src/products/stock.ts`.
 *
 * A product with no sizes still has one variant, with an empty size label, so
 * both cases read the same way.
 */
export function stockForSize(
  product: { variants?: VariantLike[] | null },
  size: string | null,
): number {
  const variant = (product.variants ?? []).find((v) => v.size === (size ?? ""));
  if (!variant || variant.isActive === false) return 0;
  return Math.max(variant.stock, 0);
}

/** The sizes to render in the picker — retired ones are omitted entirely. */
export function pickableVariants(product: {
  variants?: VariantLike[] | null;
}): VariantLike[] {
  return (product.variants ?? []).filter((v) => v.isActive !== false);
}

/** Nothing at all can be bought. */
export function isSoldOut(product: { variants?: VariantLike[] | null }): boolean {
  return !pickableVariants(product).some((v) => v.stock > 0);
}

/** Unit price for a size, including any per-size delta. */
export function priceForSize(
  product: { priceCents: number; variants?: VariantLike[] | null },
  size: string | null,
): number {
  const variant = (product.variants ?? []).find((v) => v.size === (size ?? ""));
  return product.priceCents + (variant?.priceDeltaCents ?? 0);
}
