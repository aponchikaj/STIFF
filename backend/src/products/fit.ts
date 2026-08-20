/**
 * What a product's fit ratings add up to.
 *
 * Three buckets, not five stars. "Runs small / true to size / runs large" is
 * the question someone standing in front of a size chart actually has, and a
 * mean of 4.2 stars answers none of it. It is also the only rating a shop this
 * size can collect honestly: it comes from people who bought the thing.
 */

/** -1 runs small, 0 true to size, 1 runs large. */
export const FIT_VALUES = [-1, 0, 1] as const;
export type FitValue = (typeof FIT_VALUES)[number];

export function isFitValue(value: unknown): value is FitValue {
  return FIT_VALUES.includes(value as FitValue);
}

export interface FitCounts {
  small: number;
  true: number;
  large: number;
}

export type FitVerdict = 'runs_small' | 'true_to_size' | 'runs_large';

export interface FitSummary extends FitCounts {
  total: number;
  /**
   * Null until enough people have answered.
   *
   * One person's opinion presented as "this runs small" is worse than saying
   * nothing — it reads as a fact about the garment when it is a fact about one
   * body.
   */
  verdict: FitVerdict | null;
  /** How many of `total` chose the winning bucket. Null with no verdict. */
  agreeing: number | null;
}

/** Below this, the page says how many have answered instead of a verdict. */
export const FIT_MIN_RESPONSES = 3;

export function summarizeFit(
  counts: FitCounts,
  minResponses: number = FIT_MIN_RESPONSES,
): FitSummary {
  const small = Math.max(0, counts.small);
  const trueToSize = Math.max(0, counts.true);
  const large = Math.max(0, counts.large);
  const total = small + trueToSize + large;

  if (total < minResponses) {
    return {
      small,
      true: trueToSize,
      large,
      total,
      verdict: null,
      agreeing: null,
    };
  }

  const ranked: [FitVerdict, number][] = [
    ['runs_small', small],
    ['true_to_size', trueToSize],
    ['runs_large', large],
  ];
  const top = Math.max(small, trueToSize, large);
  const leaders = ranked.filter(([, count]) => count === top);

  // A split room reads as true to size, whichever two buckets are tied.
  // Half the buyers saying "small" and half saying "large" does not mean the
  // garment runs small — it means it runs as expected and bodies differ, and
  // announcing either extreme would send half of them to the wrong size.
  const [verdict, agreeing] =
    leaders.length === 1 ? leaders[0] : (['true_to_size', trueToSize] as const);

  return { small, true: trueToSize, large, total, verdict, agreeing };
}

/** Which column a rating lands in. */
export function fitColumn(
  value: FitValue,
): 'fitSmallCount' | 'fitTrueCount' | 'fitLargeCount' {
  if (value === -1) return 'fitSmallCount';
  if (value === 1) return 'fitLargeCount';
  return 'fitTrueCount';
}

const VERDICT_COPY: Record<FitVerdict, string> = {
  runs_small: 'Runs small',
  true_to_size: 'True to size',
  runs_large: 'Runs large',
};

/** One line for the product page. Null when there is nothing worth saying. */
export function fitLine(summary: FitSummary): string | null {
  if (!summary.verdict || summary.agreeing === null) return null;
  return `${VERDICT_COPY[summary.verdict]} — ${summary.agreeing} of ${summary.total} buyers`;
}
