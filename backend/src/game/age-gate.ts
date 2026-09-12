import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MINIMUM_AGE } from './rules';

/**
 * The 16+ rule, as arithmetic.
 *
 * Pure so it can be tested against fixed dates. Dates are handled as
 * `YYYY-MM-DD` strings and compared by calendar parts rather than by
 * milliseconds — someone born on 11 September 2010 turns sixteen on
 * 11 September 2026 wherever they are, and a millisecond comparison across
 * time zones would make that a day early or a day late.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Nobody playing is older than this. A typo in the year is the usual cause. */
const MAX_AGE = 120;

/**
 * Normalises a submitted date of birth, or explains why it cannot be one.
 *
 * Accepts `YYYY-MM-DD` and a full ISO timestamp (the date part is kept), and
 * refuses impossible dates (`2010-02-30`), the future, and anything that would
 * make the person more than 120 years old.
 */
export function parseBirthDate(raw: unknown, now: Date = new Date()): string {
  if (typeof raw !== 'string') {
    throw new BadRequestException('Tell us your date of birth.');
  }
  const datePart = raw.trim().slice(0, 10);
  const match = ISO_DATE.exec(datePart);
  if (!match) {
    throw new BadRequestException('Date of birth must be YYYY-MM-DD.');
  }
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const probe = new Date(Date.UTC(year, month - 1, day));
  const real =
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day;
  if (!real) throw new BadRequestException('That is not a real date.');

  const age = ageOn(datePart, now);
  if (age < 0) {
    throw new BadRequestException('Date of birth cannot be in the future.');
  }
  if (age > MAX_AGE) {
    throw new BadRequestException('Check the year of your date of birth.');
  }
  return datePart;
}

/** Whole years lived by `now`, by calendar parts. Negative for a future date. */
export function ageOn(birthDate: string, now: Date = new Date()): number {
  const [y, m, d] = birthDate.slice(0, 10).split('-').map(Number);
  let age = now.getUTCFullYear() - y;
  const birthdayPassed =
    now.getUTCMonth() + 1 > m ||
    (now.getUTCMonth() + 1 === m && now.getUTCDate() >= d);
  if (!birthdayPassed) age -= 1;
  return age;
}

export function isOldEnough(
  birthDate: string,
  now: Date = new Date(),
): boolean {
  return ageOn(birthDate, now) >= MINIMUM_AGE;
}

/**
 * The gate. Throws 403 for anyone under sixteen.
 *
 * 403 rather than 400: the request is well-formed, the person is simply not
 * allowed in, and the game app shows a different screen for each.
 */
export function assertOldEnough(
  birthDate: string,
  now: Date = new Date(),
): void {
  if (!isOldEnough(birthDate, now)) {
    throw new ForbiddenException(
      `You must be ${MINIMUM_AGE} or older to take part.`,
    );
  }
}
