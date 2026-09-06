import { containsPattern, escapeLike } from './escape-like';

/**
 * Search terms are bound parameters everywhere in this codebase and stay that
 * way — this is not an injection fix. It is about the answer being right: a `%`
 * or `_` typed into a search box is a character the person meant, not a
 * wildcard they meant to write.
 */
describe('escapeLike', () => {
  /**
   * The one that actually bites. `_` matches any single character, so an
   * unescaped search for it returns every row in the table — an admin looking
   * for an order id with an underscore in it gets the whole shop.
   */
  it('neutralises the single-character wildcard', () => {
    expect(escapeLike('_')).toBe('\\_');
    expect(escapeLike('order_id')).toBe('order\\_id');
  });

  it('neutralises the any-run wildcard', () => {
    expect(escapeLike('%')).toBe('\\%');
    expect(escapeLike('100% cotton')).toBe('100\\% cotton');
  });

  /** The escape character itself, or the escaping is trivially defeated. */
  it('escapes the backslash', () => {
    expect(escapeLike('a\\b')).toBe('a\\\\b');
    expect(escapeLike('\\%')).toBe('\\\\\\%');
  });

  it('leaves an ordinary term untouched', () => {
    expect(escapeLike('black hoodie')).toBe('black hoodie');
    expect(escapeLike('')).toBe('');
  });

  /** Georgian, and anything else non-Latin, is not a wildcard. */
  it('leaves non-Latin text alone', () => {
    expect(escapeLike('შავი')).toBe('შავი');
  });
});

describe('containsPattern', () => {
  it('wraps the term in the wildcards the caller meant', () => {
    expect(containsPattern('hoodie')).toBe('%hoodie%');
  });

  /**
   * The point: the wrapping `%` are the query's, the inner ones are the
   * person's and stay literal.
   */
  it('keeps the caller wildcards and escapes the term wildcards', () => {
    expect(containsPattern('100%')).toBe('%100\\%%');
    expect(containsPattern('_')).toBe('%\\_%');
  });

  it('matches everything only when the term is empty', () => {
    expect(containsPattern('')).toBe('%%');
  });
});
