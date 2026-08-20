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

// Payment methods, their labels and whether each is usable now live with the
// providers that implement them — see `payments/payment.types.ts`. Re-exported
// here so the checkout DTO keeps one import.
export { PAYMENT_METHODS, type PaymentMethod } from '../payments/payment.types';

export const ORDER_STATUSES = [
  'pending',
  'paid',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
] as const;

/**
 * Shipping after a free-over-X threshold is applied.
 *
 * Pickup is already free and unaffected. A threshold of 0 is off, which is the
 * shipped default — it only starts mattering once someone sets it.
 */
export function shippingAfterThreshold(
  method: ShippingMethod,
  subtotalCents: number,
  thresholdCents: number,
): number {
  const base = SHIPPING_FEES_CENTS[method];
  if (thresholdCents <= 0) return base;
  return subtotalCents >= thresholdCents ? 0 : base;
}

export function parseThresholdCents(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
