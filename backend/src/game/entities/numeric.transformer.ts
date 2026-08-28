import type { ValueTransformer } from 'typeorm';

/**
 * `numeric` comes back from node-postgres as a string, because it is arbitrary
 * precision and JavaScript numbers are not.
 *
 * Accuracy is stored as `numeric(6,3)` rather than a float on purpose — it
 * orders leaderboards and decides rank thresholds, and float ties that compare
 * differently on two machines are a miserable class of bug. Values in
 * `0.000`–`100.000` are exactly representable as doubles, so converting on the
 * way out is safe here; it would not be for money.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
