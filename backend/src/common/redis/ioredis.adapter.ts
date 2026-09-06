import Redis from 'ioredis';
import type { RedisPort } from './redis.types';

/**
 * `RedisPort` over ioredis.
 *
 * Both multi-step operations are Lua rather than round trips, because both are
 * only correct when they are atomic: a `GET` then `DEL` can delete a lock that
 * changed hands in between, and an `INCR` then `PEXPIRE` can leave a key with
 * no TTL at all if the process dies between the two — a rate-limit window that
 * never closes and locks the caller out forever.
 */

/** Delete, but only if the value is still ours. */
const RELEASE = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

/**
 * Count a hit and report the window.
 *
 * `PEXPIRE` runs only on the first hit — a window is a fixed span from when it
 * opened, not one that slides forward on every request.
 */
const HIT = `
local hits = redis.call('incr', KEYS[1])
if hits == 1 then
  redis.call('pexpire', KEYS[1], ARGV[1])
end
return { hits, redis.call('pttl', KEYS[1]) }
`;

export class IoRedisAdapter implements RedisPort {
  constructor(private readonly client: Redis) {}

  async acquire(key: string, holder: string, ttlMs: number): Promise<boolean> {
    const result = await this.client.set(key, holder, 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  async release(key: string, holder: string): Promise<boolean> {
    const deleted = await this.client.eval(RELEASE, 1, key, holder);
    return deleted === 1;
  }

  async hit(
    key: string,
    ttlMs: number,
  ): Promise<{ hits: number; ttlMs: number }> {
    const result = (await this.client.eval(HIT, 1, key, ttlMs)) as [
      number,
      number,
    ];
    const [hits, pttl] = result;
    // A key with no TTL reports -1; treat it as the full window rather than a
    // negative time-to-expire, which callers would read as "already expired".
    return { hits, ttlMs: pttl < 0 ? ttlMs : pttl };
  }

  async pttl(key: string): Promise<number> {
    return this.client.pttl(key);
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

/**
 * The client the adapter and the socket.io adapter share a configuration with.
 *
 * `maxRetriesPerRequest: null` because a command that fails during a reconnect
 * should wait for the connection rather than reject — a rate-limit check that
 * throws is a 500 on a request that was probably fine.
 */
export function createRedisClient(url: string): Redis {
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });
}
