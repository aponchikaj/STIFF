import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  ageOn,
  assertOldEnough,
  isOldEnough,
  parseBirthDate,
} from './age-gate';

/**
 * The 16+ rule. Every test pins `now`, because a birthday-arithmetic test
 * that reads the clock passes on the day it is written and fails on the
 * player's birthday a year later.
 */
const NOW = new Date('2026-09-11T12:00:00.000Z');

describe('age gate', () => {
  describe('parseBirthDate', () => {
    it('accepts YYYY-MM-DD', () => {
      expect(parseBirthDate('2005-03-14', NOW)).toBe('2005-03-14');
    });

    it('keeps the date part of a full ISO timestamp', () => {
      expect(parseBirthDate('2005-03-14T10:22:00.000Z', NOW)).toBe(
        '2005-03-14',
      );
    });

    it('trims whitespace', () => {
      expect(parseBirthDate('  2005-03-14 ', NOW)).toBe('2005-03-14');
    });

    it('refuses anything that is not a string', () => {
      for (const raw of [undefined, null, 20050314, { y: 2005 }]) {
        expect(() => parseBirthDate(raw, NOW)).toThrow(BadRequestException);
      }
    });

    it('refuses a shape that is not a date', () => {
      expect(() => parseBirthDate('14/03/2005', NOW)).toThrow(/YYYY-MM-DD/);
    });

    it('refuses a date that does not exist', () => {
      expect(() => parseBirthDate('2010-02-30', NOW)).toThrow(
        /not a real date/,
      );
    });

    it('refuses the future', () => {
      expect(() => parseBirthDate('2026-09-12', NOW)).toThrow(/future/);
    });

    it('refuses more than 120 years', () => {
      expect(() => parseBirthDate('1900-01-01', NOW)).toThrow(/year/);
    });

    it('allows exactly 120 years', () => {
      expect(parseBirthDate('1906-09-11', NOW)).toBe('1906-09-11');
    });
  });

  describe('ageOn', () => {
    it('counts the birthday itself', () => {
      expect(ageOn('2010-09-11', NOW)).toBe(16);
    });

    it('does not count the day before the birthday', () => {
      expect(ageOn('2010-09-12', NOW)).toBe(15);
    });

    it('is negative for a future date', () => {
      expect(ageOn('2027-01-01', NOW)).toBeLessThan(0);
    });

    it('handles a leap-day birthday in a non-leap year', () => {
      // 29 Feb 2008. In 2026 there is no 29 Feb: on 28 Feb they are 17, on
      // 1 Mar they are 18.
      expect(ageOn('2008-02-29', new Date('2026-02-28T12:00:00Z'))).toBe(17);
      expect(ageOn('2008-02-29', new Date('2026-03-01T12:00:00Z'))).toBe(18);
    });
  });

  describe('isOldEnough / assertOldEnough', () => {
    it('passes someone who turns sixteen today', () => {
      expect(isOldEnough('2010-09-11', NOW)).toBe(true);
      expect(() => assertOldEnough('2010-09-11', NOW)).not.toThrow();
    });

    it('refuses someone who turns sixteen tomorrow, with a 403', () => {
      expect(isOldEnough('2010-09-12', NOW)).toBe(false);
      expect(() => assertOldEnough('2010-09-12', NOW)).toThrow(
        ForbiddenException,
      );
      expect(() => assertOldEnough('2010-09-12', NOW)).toThrow(/16 or older/);
    });
  });
});
