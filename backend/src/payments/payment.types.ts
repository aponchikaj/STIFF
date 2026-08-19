import type { Order } from '../orders/order.entity';

/**
 * How the money arrives.
 *
 * Card is split by acquirer rather than offered as one "Card" button: in
 * Georgia the shop holds a merchant account with a specific bank, and which
 * one is live depends on which contract exists. Either, both, or neither can
 * be configured — `PaymentsService` only offers what is actually usable.
 */
export const PAYMENT_METHODS = [
  'cod',
  'bank_transfer',
  'card_tbc',
  'card_bog',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly unknown[]).includes(value);
}

/** What the shop should do with the order once checkout returns. */
export type PaymentStart =
  /** Nothing to collect now — money changes hands on delivery. */
  | { kind: 'on_delivery' }
  /** Show the buyer where to send the money; a human confirms it later. */
  | { kind: 'instructions'; heading: string; lines: string[] }
  /** Send the buyer to the acquirer's hosted page. */
  | { kind: 'redirect'; url: string; reference: string }
  /**
   * Test mode only. The gateway was never contacted; the order is marked paid
   * so the rest of the flow can be exercised. Never returned when live.
   */
  | { kind: 'simulated'; reference: string };

export interface PaymentAvailability {
  method: PaymentMethod;
  label: string;
  /** Shown under the option in checkout. */
  note: string;
  /** False renders the option disabled rather than hiding it. */
  available: boolean;
  /** True when this will not really move money — surfaced in the UI. */
  testMode: boolean;
}

/**
 * One way of taking payment.
 *
 * Providers never write order status themselves; they report what happened and
 * `PaymentsService` owns the transition. That keeps "what makes an order paid"
 * in one place instead of spread across four integrations.
 */
export interface PaymentProvider {
  readonly method: PaymentMethod;
  readonly label: string;

  /** Copy shown beneath the option at checkout. */
  note(): string;

  /**
   * False when the credentials this provider needs are missing, which is how
   * an unconfigured acquirer shows up as "coming soon" instead of failing at
   * the moment someone tries to pay.
   */
  isConfigured(): boolean;

  start(order: Order): Promise<PaymentStart>;
}
