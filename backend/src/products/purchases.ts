/**
 * What counts as having bought something.
 *
 * `pending` is deliberately excluded: an order nobody has paid for yet is a
 * statement of intent, and a "verified buyer" badge earned by placing an
 * unpaid order would be trivially forgeable. `cancelled` is excluded for the
 * obvious reason.
 *
 * The same list decides who may rate fit, because both answer one question —
 * has this person actually held the garment.
 */
export const PURCHASED_STATUSES = [
  'paid',
  'packed',
  'shipped',
  'delivered',
] as const;
