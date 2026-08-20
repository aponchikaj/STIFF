import {
  GEORGIA_REGIONS,
  isGeorgiaRegion,
  isGeorgianPhone,
  normalizeGeorgianPhone,
  normalizePostalCode,
} from './georgia';

describe('normalizeGeorgianPhone', () => {
  it('accepts the shape people are told to use', () => {
    expect(normalizeGeorgianPhone('+995555123456')).toBe('+995555123456');
  });

  it.each([
    ['spaces', '+995 555 12 34 56'],
    ['dashes', '+995-555-123-456'],
    ['no plus', '995555123456'],
    ['international prefix', '00995555123456'],
    ['national with trunk zero', '0555123456'],
    ['bare national', '555123456'],
  ])('reads a number written with %s', (_label, input) => {
    // People type these five different ways; the courier needs one.
    expect(normalizeGeorgianPhone(input)).toBe('+995555123456');
  });

  it('accepts a Tbilisi landline', () => {
    expect(normalizeGeorgianPhone('+995322123456')).toBe('+995322123456');
  });

  it('rejects a number that is too short or too long', () => {
    expect(normalizeGeorgianPhone('+99555512345')).toBeNull();
    expect(normalizeGeorgianPhone('+9955551234567')).toBeNull();
  });

  it('rejects a subscriber number that cannot be Georgian', () => {
    // Georgian numbers start 3, 4 or 5.
    expect(normalizeGeorgianPhone('+995155123456')).toBeNull();
    expect(normalizeGeorgianPhone('+995955123456')).toBeNull();
  });

  it('rejects rubbish rather than guessing', () => {
    expect(normalizeGeorgianPhone('')).toBeNull();
    expect(normalizeGeorgianPhone('not a phone')).toBeNull();
    expect(normalizeGeorgianPhone('+44 20 7946 0000')).toBeNull();
  });

  it('isGeorgianPhone agrees with it', () => {
    expect(isGeorgianPhone('555 123 456')).toBe(true);
    expect(isGeorgianPhone('12345')).toBe(false);
  });
});

describe('regions', () => {
  it('covers all eleven', () => {
    expect(GEORGIA_REGIONS).toHaveLength(11);
    expect(GEORGIA_REGIONS).toContain('Tbilisi');
    expect(GEORGIA_REGIONS).toContain('Adjara');
  });

  it('recognises a real one and refuses anything else', () => {
    expect(isGeorgiaRegion('Kakheti')).toBe(true);
    expect(isGeorgiaRegion('Bavaria')).toBe(false);
    expect(isGeorgiaRegion(undefined)).toBe(false);
    expect(isGeorgiaRegion('')).toBe(false);
  });
});

describe('normalizePostalCode', () => {
  it('keeps a four-digit code', () => {
    expect(normalizePostalCode('0105')).toBe('0105');
  });

  it('treats an empty one as absent, not invalid', () => {
    // Widely unused here; requiring it turned people away for nothing.
    expect(normalizePostalCode('')).toBeNull();
    expect(normalizePostalCode('   ')).toBeNull();
    expect(normalizePostalCode(undefined)).toBeNull();
  });

  it('drops something that is not a Georgian postcode', () => {
    expect(normalizePostalCode('SW1A 1AA')).toBeNull();
    expect(normalizePostalCode('123')).toBeNull();
  });
});
