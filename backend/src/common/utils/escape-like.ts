/**
 * Escapes the wildcards inside a `LIKE` / `ILIKE` pattern.
 *
 * Not an injection fix — every search term in this codebase is already a bound
 * parameter, and it stays one. This is about the answer being right: inside a
 * pattern, `%` matches any run of characters and `_` matches any single one, so
 * an admin searching orders for `_` currently matches every order in the shop,
 * and a shopper searching products for `100%` matches things that have nothing
 * to do with it.
 *
 * Postgres needs `ESCAPE '\'` on the query for the backslashes to mean
 * anything, so this is only half the fix — the call sites carry the other half.
 */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * A `%term%` pattern with the term's own wildcards neutralised.
 *
 * The shape every "contains" search in the shop wants.
 */
export function containsPattern(term: string): string {
  return `%${escapeLike(term)}%`;
}
