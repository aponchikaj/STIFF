import { corsOrigins } from './configure-app';

/**
 * The CORS list is an allowlist, and this pins it.
 *
 * Three sessions live on three origins and none of them is interchangeable
 * (see `jwt-auth.guard.spec.ts`), so the set of origins that may present a
 * cookie at all is a security boundary rather than a convenience. Widening it
 * should be a deliberate edit that fails a test, not something that arrives in
 * a diff about something else.
 */
describe('corsOrigins', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  it('allows each stiff.ge site that actually exists', () => {
    const origins = corsOrigins();
    expect(origins).toEqual(
      expect.arrayContaining([
        'https://stiff.ge',
        'https://www.stiff.ge',
        'https://staff.stiff.ge',
        'https://admin.stiff.ge',
        'https://game.stiff.ge',
        'https://stage.stiff.ge',
        'https://pre-prod.stiff.ge',
      ]),
    );
  });

  /**
   * The game is a second domain, not a subdomain — so its panel is cross-site
   * to the API by construction, and being absent here is the whole difference
   * between the panel working and every request failing in the browser.
   */
  it('allows the game and its panel on stiff.co', () => {
    const origins = corsOrigins();
    expect(origins).toEqual(
      expect.arrayContaining([
        'https://stiff.co',
        'https://www.stiff.co',
        'https://admin.stiff.co',
      ]),
    );
  });

  /**
   * A subdomain nobody serves is a subdomain someone else can take. The list
   * names hosts one at a time for exactly that reason — there is no wildcard.
   */
  it('does not allow a wildcard or an unserved subdomain', () => {
    const origins = corsOrigins();
    expect(origins).not.toContain('*');
    expect(origins).not.toContain('https://stiff.ge/*');
    expect(origins.some((o) => o.includes('*'))).toBe(false);
    expect(origins).not.toContain('https://api.stiff.ge');
    expect(origins).not.toContain('http://stiff.ge');
  });

  describe('local development', () => {
    it('falls back to the port each app actually runs on', () => {
      delete process.env.FRONTEND_URL;
      delete process.env.STAFF_FRONTEND_URL;
      delete process.env.ADMIN_FRONTEND_URL;
      delete process.env.GAME_FRONTEND_URL;
      delete process.env.GAME_ADMIN_FRONTEND_URL;

      const origins = corsOrigins();
      expect(origins).toEqual(
        expect.arrayContaining([
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:3003',
          // The game's panel. Its own port, because it is its own app.
          'http://localhost:3004',
        ]),
      );
    });
  });

  it('takes the deployed origins from the environment', () => {
    process.env.GAME_FRONTEND_URL = 'https://game.example.test';
    process.env.GAME_ADMIN_FRONTEND_URL = 'https://panel.example.test';
    const origins = corsOrigins();
    expect(origins).toContain('https://game.example.test');
    expect(origins).toContain('https://panel.example.test');
  });

  /** Set to the same value twice, the list must not carry it twice. */
  it('deduplicates', () => {
    process.env.FRONTEND_URL = 'https://stiff.ge';
    const origins = corsOrigins();
    expect(origins.filter((o) => o === 'https://stiff.ge')).toHaveLength(1);
    expect(new Set(origins).size).toBe(origins.length);
  });
});
