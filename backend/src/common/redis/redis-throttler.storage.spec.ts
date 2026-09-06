import { RedisThrottlerStorage } from './redis-throttler.storage';
import type { RedisPort } from './redis.types';

/**
 * Rate limits shared across instances.
 *
 * The behaviour worth pinning is what happens when Redis misbehaves. A limiter
 * that throws under load takes the site down at exactly the moment it was
 * supposed to protect it, so this one fails open — and that has to be a
 * decision a test holds, not something a future refactor quietly reverses.
 */

/**
 * Hands back the mocks alongside the port, so assertions reference locals
 * rather than reading methods off the object.
 */
function fakeRedis(
  overrides: Partial<Record<keyof RedisPort, jest.Mock>> = {},
) {
  const mocks = {
    acquire: overrides.acquire ?? jest.fn(),
    release: overrides.release ?? jest.fn(),
    hit:
      overrides.hit ?? jest.fn().mockResolvedValue({ hits: 1, ttlMs: 60_000 }),
    pttl: overrides.pttl ?? jest.fn().mockResolvedValue(-2),
    disconnect: overrides.disconnect ?? jest.fn(),
  };
  return { port: mocks as unknown as RedisPort, ...mocks };
}

describe('RedisThrottlerStorage', () => {
  it('counts a hit and reports the window', async () => {
    const { port } = fakeRedis({
      hit: jest.fn().mockResolvedValue({ hits: 3, ttlMs: 42_000 }),
    });
    const storage = new RedisThrottlerStorage(port);

    const record = await storage.increment(
      '1.2.3.4',
      60_000,
      100,
      0,
      'default',
    );

    expect(record).toEqual({
      totalHits: 3,
      timeToExpire: 42,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  /** Namespaced so two throttlers cannot share a counter. */
  it('keys by throttler name as well as by caller', async () => {
    const { port, hit } = fakeRedis();
    await new RedisThrottlerStorage(port).increment(
      '1.2.3.4',
      60_000,
      5,
      0,
      'login',
    );
    expect(hit).toHaveBeenCalledWith('throttle:login:1.2.3.4', 60_000);
  });

  it('blocks once the limit is passed', async () => {
    const { port } = fakeRedis({
      hit: jest.fn().mockResolvedValue({ hits: 6, ttlMs: 30_000 }),
    });
    const storage = new RedisThrottlerStorage(port);

    const record = await storage.increment(
      '1.2.3.4',
      60_000,
      5,
      120_000,
      'login',
    );

    expect(record.isBlocked).toBe(true);
    expect(record.timeToBlockExpire).toBe(120);
  });

  /**
   * Asking "are they blocked" must be a read. Counting it as a hit means every
   * rejected request extends the block that rejected it — a caller who retries
   * can never get out.
   */
  it('reports an existing block without counting another hit', async () => {
    const { port, hit } = fakeRedis({
      pttl: jest.fn().mockResolvedValue(45_000),
    });
    const storage = new RedisThrottlerStorage(port);

    const record = await storage.increment(
      '1.2.3.4',
      60_000,
      5,
      120_000,
      'login',
    );

    expect(record.isBlocked).toBe(true);
    expect(record.timeToBlockExpire).toBe(45);
    expect(hit).not.toHaveBeenCalled();
  });

  it('treats a missing block key as not blocked', async () => {
    const { port } = fakeRedis({ pttl: jest.fn().mockResolvedValue(-2) });
    const record = await new RedisThrottlerStorage(port).increment(
      '1.2.3.4',
      60_000,
      5,
      120_000,
      'login',
    );
    expect(record.isBlocked).toBe(false);
  });

  it('does not open a block when the throttler asks for none', async () => {
    const { port, hit } = fakeRedis({
      hit: jest.fn().mockResolvedValue({ hits: 99, ttlMs: 1000 }),
    });
    await new RedisThrottlerStorage(port).increment(
      'ip',
      60_000,
      5,
      0,
      'default',
    );
    expect(hit).toHaveBeenCalledTimes(1);
  });

  /**
   * The decision this file exists to hold. Redis going down must not take
   * every request down with it — the limiter is a guard, not a dependency of
   * being able to serve at all.
   */
  describe('when Redis fails', () => {
    it('lets the request through rather than throwing', async () => {
      const { port } = fakeRedis({
        pttl: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      });
      const storage = new RedisThrottlerStorage(port);

      const record = await storage.increment('ip', 60_000, 5, 0, 'default');

      expect(record).toEqual({
        totalHits: 1,
        timeToExpire: 60,
        isBlocked: false,
        timeToBlockExpire: 0,
      });
    });

    it('fails open on the counter too, not just the block check', async () => {
      const { port } = fakeRedis({
        hit: jest.fn().mockRejectedValue(new Error('LOADING')),
      });
      const record = await new RedisThrottlerStorage(port).increment(
        'ip',
        60_000,
        5,
        0,
        'default',
      );
      expect(record.isBlocked).toBe(false);
    });
  });
});
