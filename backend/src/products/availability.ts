/**
 * Whether a line may be sold, and on what terms.
 *
 * Pure so the rules can be tested directly — "why did it let me order 12 of
 * something with 3 in stock" needs an answer that does not depend on reading a
 * repository mock.
 */

export interface VariantAvailability {
  stock: number;
  isActive: boolean;
}

export type Availability =
  { kind: 'in_stock'; max: number } | { kind: 'unavailable'; reason: string };

/** How many units of one size a customer may put in a basket right now. */
export function availability(variant: VariantAvailability): Availability {
  if (!variant.isActive) {
    return { kind: 'unavailable', reason: 'That size is no longer sold.' };
  }
  if (variant.stock > 0) {
    return { kind: 'in_stock', max: variant.stock };
  }
  return { kind: 'unavailable', reason: 'That size is sold out.' };
}

// ------------------------------------------------------------ drop timing --

export interface Publishable {
  isActive: boolean;
  publishAt?: Date | string | null;
}

/**
 * Whether a product should be visible to shoppers now.
 *
 * `publishAt` in the future keeps it hidden even if someone ticked active — a
 * drop that leaks early is the failure this prevents. A product with no
 * publishAt is governed by `isActive` alone, which is every product today.
 */
export function isLive(product: Publishable, now: Date = new Date()): boolean {
  if (!product.isActive) return false;
  if (!product.publishAt) return true;
  return new Date(product.publishAt).getTime() <= now.getTime();
}
