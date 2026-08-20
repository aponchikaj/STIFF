import { prefixTerm } from './search.sql';

describe('prefixTerm', () => {
  it('turns the last word into a prefix query so results appear mid-typing', () => {
    expect(prefixTerm('hoo')).toBe('hoo:*');
    expect(prefixTerm('heavy hoo')).toBe('hoo:*');
  });

  it('ignores a trailing word too short to be worth a prefix scan', () => {
    expect(prefixTerm('a')).toBeNull();
    expect(prefixTerm('heavy a')).toBeNull();
  });

  it('returns null for nothing to search', () => {
    expect(prefixTerm('')).toBeNull();
    expect(prefixTerm('   ')).toBeNull();
  });

  it('strips characters tsquery would read as operators', () => {
    // Left in, these would make to_tsquery throw on ordinary punctuation.
    expect(prefixTerm('hood!e')).toBe('hoode:*');
    expect(prefixTerm("jacket'")).toBe('jacket:*');
    expect(prefixTerm('tee&shirt')).toBe('teeshirt:*');
    expect(prefixTerm('a|b')).toBe('ab:*');
  });

  it('drops a final token that is only punctuation', () => {
    expect(prefixTerm('jacket &')).toBeNull();
    expect(prefixTerm('!!')).toBeNull();
  });

  it('keeps digits, so catalogue numbers still prefix-match', () => {
    expect(prefixTerm('0011')).toBe('0011:*');
  });

  it('handles irregular whitespace', () => {
    expect(prefixTerm('  heavy   hoodie  ')).toBe('hoodie:*');
  });
});
