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

export const PAYMENT_METHODS = ["cod", "bank_transfer", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cod: "Pay on delivery",
  bank_transfer: "Bank transfer",
  card: "Card",
};

export const LIVE_PAYMENT_METHODS: PaymentMethod[] = ["cod", "bank_transfer"];

export const PAYMENT_NOTES: Record<PaymentMethod, string> = {
  cod: "Pay when it arrives, or when you pick it up.",
  bank_transfer:
    "Place the order and we'll follow up with transfer details. It stays pending until we confirm payment.",
  card: "Card checkout is not live yet.",
};

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
