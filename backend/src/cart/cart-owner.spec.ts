import {
  isGuestId,
  newGuestId,
  ownerWhere,
  type CartOwner,
} from './cart-owner';

describe('cart ownership', () => {
  describe('newGuestId', () => {
    it('is 64 hex characters — 32 bytes of randomness', () => {
      expect(newGuestId()).toMatch(/^[0-9a-f]{64}$/);
    });

    it('does not repeat', () => {
      const ids = new Set(Array.from({ length: 200 }, () => newGuestId()));
      expect(ids.size).toBe(200);
    });
  });

  describe('isGuestId', () => {
    it('accepts what newGuestId produces', () => {
      expect(isGuestId(newGuestId())).toBe(true);
    });

    it.each([
      ['too short', 'abc'],
      ['uppercase hex', 'A'.repeat(64)],
      ['non-hex', 'z'.repeat(64)],
      ['65 chars', '0'.repeat(65)],
      ['63 chars', '0'.repeat(63)],
      ['a uuid', '94da85bc-e5c5-4ed4-8e7c-e9b461a3d2d2'],
      ['empty', ''],
    ])('rejects %s', (_label, value) => {
      expect(isGuestId(value)).toBe(false);
    });

    it('rejects non-strings from a tampered cookie jar', () => {
      expect(isGuestId(undefined)).toBe(false);
      expect(isGuestId(null)).toBe(false);
      expect(isGuestId(12345)).toBe(false);
      expect(isGuestId(['a'.repeat(64)])).toBe(false);
      expect(isGuestId({ toString: () => '0'.repeat(64) })).toBe(false);
    });
  });

  describe('ownerWhere', () => {
    it('scopes to the user and never mentions guestId', () => {
      const owner: CartOwner = { kind: 'user', userId: 'u1' };
      expect(ownerWhere(owner)).toEqual({ userId: 'u1' });
      expect('guestId' in ownerWhere(owner)).toBe(false);
    });

    it('scopes to the guest and never mentions userId', () => {
      const owner: CartOwner = { kind: 'guest', guestId: 'g1' };
      expect(ownerWhere(owner)).toEqual({ guestId: 'g1' });
      expect('userId' in ownerWhere(owner)).toBe(false);
    });
  });
});
