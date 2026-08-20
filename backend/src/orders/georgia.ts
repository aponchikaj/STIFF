/**
 * Address shape for a shop that delivers inside Georgia.
 *
 * This is address *shape*, not localisation — every label the customer reads
 * stays English. What changes is which fields are asked for and how they are
 * validated: the form was a generic Western one asking for a postcode most
 * Georgian addresses do not use, and accepting any string as a phone number.
 */

/** The nine regions plus Tbilisi, Abkhazia and South Ossetia. */
export const GEORGIA_REGIONS = [
  'Tbilisi',
  'Adjara',
  'Guria',
  'Imereti',
  'Kakheti',
  'Kvemo Kartli',
  'Mtskheta-Mtianeti',
  'Racha-Lechkhumi and Kvemo Svaneti',
  'Samegrelo-Zemo Svaneti',
  'Samtskhe-Javakheti',
  'Shida Kartli',
] as const;

export type GeorgiaRegion = (typeof GEORGIA_REGIONS)[number];

export function isGeorgiaRegion(value: unknown): value is GeorgiaRegion {
  return (
    typeof value === 'string' &&
    (GEORGIA_REGIONS as readonly string[]).includes(value)
  );
}

/**
 * Normalises a Georgian mobile or landline to +995XXXXXXXXX.
 *
 * People type these five different ways — with the country code, without it,
 * with a leading zero, with spaces or dashes. Storing one shape is what lets a
 * courier actually dial it. Returns null when it cannot be read as Georgian,
 * rather than guessing.
 */
export function normalizeGeorgianPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return null;

  let rest: string;
  if (digits.startsWith('+995')) {
    rest = digits.slice(4);
  } else if (digits.startsWith('995')) {
    rest = digits.slice(3);
  } else if (digits.startsWith('00995')) {
    rest = digits.slice(5);
  } else {
    // A national number, sometimes written with a trunk zero.
    rest = digits.replace(/^\+/, '').replace(/^0/, '');
  }

  if (!/^\d{9}$/.test(rest)) return null;
  // Georgian subscriber numbers start 5 (mobile) or 3/4 (fixed line).
  if (!/^[345]/.test(rest)) return null;
  return `+995${rest}`;
}

export function isGeorgianPhone(raw: string): boolean {
  return normalizeGeorgianPhone(raw) !== null;
}

/**
 * Postcodes exist in Georgia but are four digits and widely unused, so they
 * are optional — a required postcode field was turning people away at a step
 * that carries no delivery information.
 */
export function normalizePostalCode(raw: string | undefined): string | null {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return null;
  return /^\d{4}$/.test(trimmed) ? trimmed : null;
}
