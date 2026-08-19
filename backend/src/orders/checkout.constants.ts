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
