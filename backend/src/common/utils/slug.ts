/**
 * URL-safe form of a title.
 *
 * Archive titles are numbers ("0057") and survive this untouched; anything
 * typed by hand becomes lowercase and hyphenated so it can't produce a link
 * that needs escaping.
 */
export function slugify(input: string): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  // Non-Latin titles (Georgian, say) strip to nothing — fall back to a
  // timestamp rather than saving an empty slug the router can't address.
  return slug || `item-${Date.now()}`;
}

/** Archive numbering is zero-padded to four digits. */
export function padNumber(n: number): string {
  return String(n).padStart(4, '0');
}
