import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { REDIS, type RedisPort } from './redis.types';

/**
 * Runs a job on exactly one instance.
 *
 * `@nestjs/schedule` fires every `@Cron` on every process that boots. With one
 * instance that is the intended behaviour; with three it means three analytics
 * snapshots, three token purges, and — the one a customer notices — three
 * abandoned-cart emails to the same person.
 *
 * **Without Redis the job runs unconditionally**, which is correct for a single
 * instance and the deployment this repo has today. The lock is what makes
 * adding a second instance safe rather than something that quietly triples
 * every scheduled side effect.
 */
@Injectable()
export class LeaderLockService {
  private readonly logger = new Logger(LeaderLockService.name);

  /**
   * Identifies this process for the lifetime of the process.
   *
   * A lock is released only by its holder, so the value has to be unique per
   * process — a shared constant would let one instance release another's lock
   * and reintroduce the concurrency the lock prevents.
   */
  private readonly holder = randomUUID();

  constructor(
    @Optional() @Inject(REDIS) private readonly redis: RedisPort | null,
  ) {}

  get isDistributed(): boolean {
    return this.redis !== null;
  }

  /**
   * Runs `job` if this instance can take the named lock.
   *
   * Returns what the job returned, or `null` when another instance held the
   * lock — the ordinary outcome for every process except one, and not a
   * failure.
   *
   * `ttlMs` should exceed the job's worst-case runtime. If a job overruns, the
   * lock expires and a later tick may start a second run; that is a deliberate
   * trade against the alternative, where a process that dies mid-job holds the
   * lock forever and the work silently stops happening.
   */
  async withLock<T>(
    name: string,
    ttlMs: number,
    job: () => Promise<T>,
  ): Promise<T | null> {
    const redis = this.redis;
    if (!redis) return job();

    const key = `cron-lock:${name}`;
    let acquired = false;
    try {
      acquired = await redis.acquire(key, this.holder, ttlMs);
    } catch (err) {
      // Redis being unreachable must not stop the work. One instance running
      // a job twice is recoverable; nobody running it at all is a cron that
      // silently stopped, which is the failure that goes unnoticed for weeks.
      this.logger.warn(
        `Could not reach Redis for lock "${name}" — running unlocked: ${message(err)}`,
      );
      return job();
    }

    if (!acquired) return null;

    try {
      return await job();
    } finally {
      // Only ever releases a lock we still hold; an overrun has already lost
      // it, and deleting the new holder's lock is the bug this guards.
      try {
        await redis.release(key, this.holder);
      } catch (err) {
        // The TTL will clear it. Not worth failing the job over.
        this.logger.debug(
          `Could not release lock "${name}"; leaving it to expire: ${message(err)}`,
        );
      }
    }
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
