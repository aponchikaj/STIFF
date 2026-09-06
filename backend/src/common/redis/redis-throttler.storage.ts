import type { ThrottlerStorage } from '@nestjs/throttler';
// The record type is not re-exported from the package root in v6, only from
// the interface module it is declared in.
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import type { RedisPort } from './redis.types';

/**
 * Rate limits that hold across instances.
 *
 * `ThrottlerModule.forRoot` with no storage keeps its counters in process
 * memory, which is correct for one instance and quietly wrong for two: three
 * processes behind a load balancer turn a 5-per-minute login limit into 15,
 * and the limit that matters most — the one on `/auth/login` — is the one that
 * loosens the most, because credential stuffing spreads across connections by
 * nature.
 *
 * Nothing here fails a request when Redis does. A rate limiter that 500s under
 * load is worse than one that briefly counts low: the whole point is to survive
 * the moment when traffic is abnormal, and that is exactly when a dependency
 * is most likely to be struggling.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisPort) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `throttle-block:${throttlerName}:${key}`;

    try {
      // A read, not a probe. Asking "are they blocked" must not itself count
      // as a request against them, or every rejected call extends the block.
      const blockedFor = await this.redis.pttl(blockKey);
      if (blockedFor > 0) {
        const seconds = Math.ceil(blockedFor / 1000);
        return {
          totalHits: limit + 1,
          timeToExpire: seconds,
          isBlocked: true,
          timeToBlockExpire: seconds,
        };
      }

      const { hits, ttlMs } = await this.redis.hit(hitKey, ttl);
      const isBlocked = hits > limit;

      if (isBlocked && blockDuration > 0) {
        // First hit on the block key creates it with the block's own TTL.
        await this.redis.hit(blockKey, blockDuration);
      }

      return {
        totalHits: hits,
        timeToExpire: Math.ceil(ttlMs / 1000),
        isBlocked,
        timeToBlockExpire: isBlocked ? Math.ceil(blockDuration / 1000) : 0,
      };
    } catch {
      // Fail open, deliberately. See the class comment: a limiter that throws
      // during an incident takes the site down instead of protecting it.
      return {
        totalHits: 1,
        timeToExpire: Math.ceil(ttl / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
