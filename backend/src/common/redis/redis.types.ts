/**
 * The narrow slice of Redis this codebase actually uses.
 *
 * Three operations, named for what they are for rather than for the commands
 * behind them. Written as a port rather than passing `ioredis` around for two
 * reasons: the pieces that depend on Redis — rate limiting, cron leadership —
 * are exactly the pieces that must be tested without one, and a four-method
 * interface makes the blast radius of "swap the client" one file.
 *
 * `null` is a first-class value everywhere this appears. Redis is optional:
 * unset, the app runs single-instance with in-memory rate limits and
 * unconditional cron, which is correct for one process and wrong for two. The
 * boot log says which mode it is in.
 */
export interface RedisPort {
  /**
   * Take a lock, if nobody holds it.
   *
   * `SET key value NX PX ttl`. Returns false when it is already held — which
   * is the ordinary case for every instance except the one doing the work.
   */
  acquire(key: string, holder: string, ttlMs: number): Promise<boolean>;

  /**
   * Release a lock, but only if we still hold it.
   *
   * The `holder` check is the whole point. A job that overran its TTL has
   * already lost the lock to somebody else, and a plain `DEL` would delete
   * *their* lock — turning one slow run into two concurrent ones, which is the
   * failure the lock existed to prevent.
   */
  release(key: string, holder: string): Promise<boolean>;

  /**
   * Count a hit against a window, returning the running total and what is left
   * of the window.
   *
   * The TTL is set only when the key is created, so a window is a fixed span
   * from its first hit rather than one that slides forward on every request —
   * sliding would let a steady stream hold a window open indefinitely.
   */
  hit(key: string, ttlMs: number): Promise<{ hits: number; ttlMs: number }>;

  /**
   * Milliseconds left on a key, or a negative number when it does not exist.
   *
   * A read, not a probe — checking whether a caller is currently blocked must
   * not itself count as a request against them.
   */
  pttl(key: string): Promise<number>;

  disconnect(): Promise<void>;
}

/** DI token. Resolves to `null` when Redis is not configured. */
export const REDIS = Symbol('REDIS');
