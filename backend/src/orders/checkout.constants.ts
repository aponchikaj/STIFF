/** Tbilisi-shaped shipping. Fees are placeholders until a courier contract exists. */
export const SHIPPING_METHODS = ['pickup', 'tbilisi', 'regions'] as const;
export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

export const SHIPPING_FEES_CENTS: Record<ShippingMethod, number> = {
  pickup: 0,
  tbilisi: 500,
  regions: 1000,
};

export const SHIPPING_LABELS: Record<ShippingMethod, string> = {
  pickup: 'Pickup in Tbilisi',
  tbilisi: 'Tbilisi courier',
  regions: 'Georgia regions',
};

/** Card is a placeholder until a merchant account exists. */
export const PAYMENT_METHODS = ['cod', 'bank_transfer', 'card'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cod: 'Pay on delivery',
  bank_transfer: 'Bank transfer',
  card: 'Card (coming soon)',
};

export const ORDER_STATUSES = [
  'pending',
  'paid',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
] as const;
