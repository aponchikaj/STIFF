import { redactBody } from './admin-audit.service';

describe('redactBody', () => {
  it('strips anything whose key looks like a credential', () => {
    const out = redactBody({
      email: 'someone@example.com',
      password: 'hunter2',
      newPassword: 'hunter3',
      passwordHash: '$2b$10$abc',
      refreshToken: 'eyJ...',
      apiSecret: 'sk_live_x',
      authorization: 'Bearer abc',
    });

    expect(out).toEqual({
      email: 'someone@example.com',
      password: '[redacted]',
      newPassword: '[redacted]',
      passwordHash: '[redacted]',
      refreshToken: '[redacted]',
      apiSecret: '[redacted]',
      authorization: '[redacted]',
    });
  });

  it('redacts by key at any depth, not just the top level', () => {
    const out = redactBody({ user: { profile: { password: 'hunter2' } } });
    expect(out).toEqual({ user: { profile: { password: '[redacted]' } } });
  });

  it('keeps the ordinary fields that make an entry worth reading', () => {
    // "Order 4f2 changed" is not worth writing down; "changed to shipped" is.
    expect(redactBody({ status: 'shipped', trackingCode: 'GE123' })).toEqual({
      status: 'shipped',
      trackingCode: 'GE123',
    });
  });

  it('passes through the primitives and null', () => {
    expect(redactBody(null)).toBeNull();
    expect(redactBody(undefined)).toBeUndefined();
    expect(redactBody(42)).toBe(42);
    expect(redactBody(true)).toBe(true);
  });

  it('truncates a long string rather than storing the whole thing', () => {
    const out = redactBody({ description: 'x'.repeat(900) }) as {
      description: string;
    };
    expect(out.description).toHaveLength(501); // 500 + the ellipsis
    expect(out.description.endsWith('…')).toBe(true);
  });

  it('stops descending instead of following a deep or cyclic structure', () => {
    // A body that nests forever must not take the request down with it.
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => redactBody(cyclic)).not.toThrow();
    expect(JSON.stringify(redactBody(cyclic))).toContain('[deep]');
  });

  it('caps how many keys and array entries it keeps', () => {
    const wide = Object.fromEntries(
      Array.from({ length: 100 }, (_, i) => [`k${i}`, i]),
    );
    expect(Object.keys(redactBody(wide) as object)).toHaveLength(60);
    expect(redactBody(Array.from({ length: 100 }, (_, i) => i))).toHaveLength(
      60,
    );
  });
});
