import {
  FIT_MIN_RESPONSES,
  fitColumn,
  fitLine,
  isFitValue,
  summarizeFit,
} from './fit';

describe('fit ratings', () => {
  describe('summarizeFit', () => {
    it('withholds a verdict until enough people have answered', () => {
      // One person's opinion rendered as "this runs small" reads as a fact
      // about the garment when it is a fact about one body.
      const summary = summarizeFit({ small: 2, true: 0, large: 0 });
      expect(summary.total).toBe(2);
      expect(summary.verdict).toBeNull();
      expect(summary.agreeing).toBeNull();
    });

    it('reports the dominant bucket once it has enough', () => {
      const summary = summarizeFit({ small: 5, true: 1, large: 1 });
      expect(summary.verdict).toBe('runs_small');
      expect(summary.agreeing).toBe(5);
      expect(summary.total).toBe(7);
    });

    it('breaks a tie towards true to size', () => {
      // A coin flip between "runs small" and "runs large" would send half the
      // room to the wrong size; the neutral answer costs nobody a return.
      expect(summarizeFit({ small: 3, true: 0, large: 3 }).verdict).toBe(
        'true_to_size',
      );
      expect(summarizeFit({ small: 2, true: 2, large: 0 }).verdict).toBe(
        'true_to_size',
      );
    });

    it('answers exactly at the threshold', () => {
      const summary = summarizeFit({
        small: 0,
        true: FIT_MIN_RESPONSES,
        large: 0,
      });
      expect(summary.verdict).toBe('true_to_size');
    });

    it('clamps negative counts rather than trusting the column', () => {
      expect(summarizeFit({ small: -4, true: 3, large: 0 })).toMatchObject({
        small: 0,
        total: 3,
      });
    });

    it('is empty and silent with no ratings at all', () => {
      expect(summarizeFit({ small: 0, true: 0, large: 0 })).toEqual({
        small: 0,
        true: 0,
        large: 0,
        total: 0,
        verdict: null,
        agreeing: null,
      });
    });
  });

  describe('fitLine', () => {
    it('says how many buyers agree, not a percentage', () => {
      expect(fitLine(summarizeFit({ small: 5, true: 1, large: 1 }))).toBe(
        'Runs small — 5 of 7 buyers',
      );
    });

    it('says nothing when there is no verdict', () => {
      expect(fitLine(summarizeFit({ small: 1, true: 0, large: 0 }))).toBeNull();
    });
  });

  describe('isFitValue', () => {
    it('accepts only the three buckets', () => {
      expect(isFitValue(-1)).toBe(true);
      expect(isFitValue(0)).toBe(true);
      expect(isFitValue(1)).toBe(true);
      expect(isFitValue(2)).toBe(false);
      expect(isFitValue('0')).toBe(false);
      expect(isFitValue(null)).toBe(false);
    });
  });

  describe('fitColumn', () => {
    it('maps each value to its counter', () => {
      expect(fitColumn(-1)).toBe('fitSmallCount');
      expect(fitColumn(0)).toBe('fitTrueCount');
      expect(fitColumn(1)).toBe('fitLargeCount');
    });
  });
});
