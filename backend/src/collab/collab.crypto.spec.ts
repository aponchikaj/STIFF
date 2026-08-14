import {
  decryptToken,
  encryptToken,
  isCrawlerUserAgent,
  padSerial,
  randomToken,
  sha256,
} from './collab.crypto';

describe('collab.crypto', () => {
  it('hashes stably', () => {
    expect(sha256('abc')).toBe(sha256('abc'));
    expect(sha256('abc')).not.toBe(sha256('abd'));
    expect(sha256('abc')).toHaveLength(64);
  });

  it('round-trips encrypted tokens', () => {
    const secret = 'test-secret';
    const token = randomToken();
    const enc = encryptToken(token, secret);
    expect(enc).not.toContain(token);
    expect(decryptToken(enc, secret)).toBe(token);
  });

  it('refuses a different secret', () => {
    const enc = encryptToken('payload', 'secret-a');
    expect(() => decryptToken(enc, 'secret-b')).toThrow();
  });

  it('pads serials for print labels', () => {
    expect(padSerial(1)).toBe('001');
    expect(padSerial(47)).toBe('047');
    expect(padSerial(300)).toBe('300');
  });

  it('flags crawler user agents so link previews cannot burn a code', () => {
    expect(isCrawlerUserAgent('facebookexternalhit/1.1')).toBe(true);
    expect(isCrawlerUserAgent('Twitterbot/1.0')).toBe(true);
    expect(isCrawlerUserAgent('WhatsApp/2.0')).toBe(true);
    expect(
      isCrawlerUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      ),
    ).toBe(false);
  });
});
