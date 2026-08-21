import {
  SHIPPING_FEES_CENTS,
  SHIPPING_LABELS,
  SHIPPING_METHODS,
  ShippingMethod,
  parseThresholdCents,
} from '../orders/checkout.constants';

/**
 * What the shop actually does, as opposed to what a page says it does.
 *
 * The House rules page has been prose with a returns promise nothing enforced:
 * "14 days" was typed into copy while the returns service read its window from
 * the content registry, and nothing kept the two in step. Change the window in
 * the admin panel and the page went on promising fourteen days.
 *
 * This is the single answer both of them read. The numbers on the page are the
 * numbers the checkout charges and the returns service enforces, because they
 * come from the same place.
 */

export interface ShippingRate {
  method: ShippingMethod;
  label: string;
  feeCents: number;
}

export interface SitePolicy {
  /** Days after delivery a return can still be requested. */
  returnWindowDays: number;
  /** Order statuses a customer may still cancel from. */
  cancelStatuses: string[];
  shipping: ShippingRate[];
  /** Subtotal above which delivery is free. 0 means the offer is off. */
  freeShippingThresholdCents: number;
}

/** The registry stores these as text, because the admin form edits text. */
export function parseWindowDays(
  raw: string | undefined,
  fallback = 14,
): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function parseStatuses(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((one) => one.trim())
    .filter(Boolean);
}

export function buildPolicy(storefront: Record<string, unknown>): SitePolicy {
  return {
    returnWindowDays: parseWindowDays(
      storefront.returnWindowDays as string | undefined,
    ),
    cancelStatuses: parseStatuses(
      storefront.cancelWindowStatuses as string | undefined,
    ),
    // Straight from the constants the checkout charges from, not a second copy
    // of them written down somewhere friendlier.
    shipping: SHIPPING_METHODS.map((method) => ({
      method,
      label: SHIPPING_LABELS[method],
      feeCents: SHIPPING_FEES_CENTS[method],
    })),
    freeShippingThresholdCents: parseThresholdCents(
      storefront.freeShippingThresholdCents as string | undefined,
    ),
  };
}
