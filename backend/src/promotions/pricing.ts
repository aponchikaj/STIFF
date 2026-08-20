/**
 * How an order total is built, as pure arithmetic.
 *
 * The order is deliberate and not interchangeable:
 *
 *   subtotal → discount → shipping → gift card → total
 *
 * A percentage comes off goods only, never off shipping, or a 100% code would
 * also post the parcel for free. Shipping is added after the discount so a
 * free-shipping code has something to zero. The gift card is applied last
 * because it is money, not a rule — it pays whatever is left, including the
 * postage.
 *
 * Kept free of database access so the cart preview and checkout can both call
 * it and provably agree.
 */

export type DiscountKind = 'percent' | 'fixed' | 'free_shipping';

export interface DiscountRule {
  kind: DiscountKind;
  value: number;
  minSubtotalCents: number;
}

export interface PriceInput {
  subtotalCents: number;
  shippingCents: number;
  discount?: DiscountRule | null;
  /** Balance available on the card, not the amount to spend. */
  giftCardBalanceCents?: number;
}

export interface PriceBreakdown {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  giftCardCents: number;
  totalCents: number;
}

/** Money is integers; a percentage still has to land on one. */
function percentOf(amount: number, percent: number): number {
  return Math.round((amount * percent) / 100);
}

export function priceOrder(input: PriceInput): PriceBreakdown {
  const subtotalCents = Math.max(0, Math.round(input.subtotalCents));
  const baseShipping = Math.max(0, Math.round(input.shippingCents));
  const rule = input.discount ?? null;

  const qualifies =
    rule !== null && subtotalCents >= Math.max(0, rule.minSubtotalCents);

  let discountCents = 0;
  let shippingCents = baseShipping;

  if (qualifies && rule) {
    if (rule.kind === 'percent') {
      discountCents = percentOf(subtotalCents, clampPercent(rule.value));
    } else if (rule.kind === 'fixed') {
      // Never more than the goods are worth — a code cannot pay for shipping
      // by overflowing, and can never make a total negative.
      discountCents = Math.min(Math.max(0, rule.value), subtotalCents);
    } else {
      shippingCents = 0;
    }
  }

  const afterDiscount = subtotalCents - discountCents + shippingCents;

  const balance = Math.max(0, Math.round(input.giftCardBalanceCents ?? 0));
  const giftCardCents = Math.min(balance, afterDiscount);

  return {
    subtotalCents,
    discountCents,
    shippingCents,
    giftCardCents,
    totalCents: afterDiscount - giftCardCents,
  };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

// ---------------------------------------------------------------- validity --

export interface CodeWindow {
  isActive: boolean;
  startsAt?: Date | null;
  expiresAt?: Date | null;
}

export type CodeProblem =
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'exhausted'
  | 'already_used'
  | 'below_minimum'
  | 'empty';

export const CODE_PROBLEM_MESSAGES: Record<CodeProblem, string> = {
  inactive: 'That code is no longer active.',
  not_started: 'That code is not live yet.',
  expired: 'That code has expired.',
  exhausted: 'That code has been fully used.',
  already_used: 'You have already used that code.',
  below_minimum: 'Your order is below the minimum for that code.',
  empty: 'That gift card has no balance left.',
};

/** Live now — separate from usage limits so the message can be specific. */
export function windowProblem(
  window: CodeWindow,
  now: Date = new Date(),
): CodeProblem | null {
  if (!window.isActive) return 'inactive';
  if (window.startsAt && now < window.startsAt) return 'not_started';
  if (window.expiresAt && now > window.expiresAt) return 'expired';
  return null;
}

export function usageProblem(usage: {
  usedCount: number;
  usageLimit?: number | null;
  perUserLimit?: number | null;
  usedByThisBuyer: number;
}): CodeProblem | null {
  if (usage.usageLimit != null && usage.usedCount >= usage.usageLimit) {
    return 'exhausted';
  }
  if (
    usage.perUserLimit != null &&
    usage.usedByThisBuyer >= usage.perUserLimit
  ) {
    return 'already_used';
  }
  return null;
}

/** Codes are matched case- and space-insensitively. */
export function normalizeCode(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}
