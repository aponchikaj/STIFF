/**
 * The single copy of each search expression.
 *
 * `SearchIndexes1787173000000` builds its GIN expression indexes from exactly
 * these strings. Postgres only uses an expression index when the query repeats
 * the expression verbatim, so any edit here must be mirrored by a new migration
 * — otherwise search silently falls back to a sequential scan.
 */

export const PRODUCT_TSV = `(
  setweight(to_tsvector('english', coalesce(product."name", '')), 'A') ||
  setweight(to_tsvector('english', coalesce(product."category", '')), 'B') ||
  setweight(to_tsvector('english', coalesce(product."description", '')), 'C')
)`;

export const GALLERY_TSV = `(
  setweight(to_tsvector('english', coalesce(item."title", '')), 'A') ||
  setweight(to_tsvector('english', coalesce(item."altText", '')), 'B') ||
  setweight(to_tsvector('english', coalesce(item."description", '')), 'C')
)`;

/** Below this, a trigram match is noise rather than a near-miss. */
export const TRIGRAM_THRESHOLD = 0.2;

/**
 * `websearch_to_tsquery` accepts what people actually type — bare words,
 * "quoted phrases", OR, and leading `-` to exclude — and never throws on
 * punctuation the way `to_tsquery` does.
 *
 * The trailing prefix clause makes the last word match as the user is still
 * typing it, so "hoo" finds "hoodie" before they finish the word.
 */
export function tsQuery(alias = 'q'): string {
  return `websearch_to_tsquery('english', :${alias})`;
}

/**
 * A prefix query built from the final token, for as-you-type matching.
 * Returns null when the last token is too short to be worth a prefix scan.
 */
export function prefixTerm(query: string): string | null {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  const last = tokens[tokens.length - 1];
  if (!last || last.length < 2) return null;
  // Strip anything tsquery would treat as an operator.
  const safe = last.replace(/[^\p{L}\p{N}]/gu, '');
  return safe.length >= 2 ? `${safe}:*` : null;
}
