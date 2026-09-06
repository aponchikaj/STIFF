import { LeaderLockService } from './leader-lock.service';
import type { RedisPort } from './redis.types';

/**
 * Running a job on exactly one instance.
 *
 * The interesting cases are the ones where Redis is absent or broken, because
 * that is where the wrong choice is invisible: a lock that refuses to run the
 * job when it cannot reach Redis turns a cron into one that silently stopped
 * happening, which nobody notices for weeks.
 */

/**
 * Hands back the mocks alongside the port, so assertions reference locals
 * rather than reading methods off the object — which is both easier to follow
 * and what keeps `unbound-method` quiet.
 */
function fakeRedis(
  overrides: Partial<Record<keyof RedisPort, jest.Mock>> = {},
) {
  const mocks = {
    acquire: overrides.acquire ?? jest.fn().mockResolvedValue(true),
    release: overrides.release ?? jest.fn().mockResolvedValue(true),
    hit: overrides.hit ?? jest.fn().mockResolvedValue({ hits: 1, ttlMs: 1000 }),
    pttl: overrides.pttl ?? jest.fn().mockResolvedValue(-2),
    disconnect: overrides.disconnect ?? jest.fn().mockResolvedValue(undefined),
  };
  return { port: mocks as unknown as RedisPort, ...mocks };
}

/** The holder a given call passed. */
function holderOf(fn: jest.Mock): string {
  const [, holder] = fn.mock.calls[0] as [string, string, number];
  return holder;
}

describe('LeaderLockService', () => {
  describe('without Redis', () => {
    const service = new LeaderLockService(null);

    it('says it is not distributed', () => {
      expect(service.isDistributed).toBe(false);
    });

    /**
     * Correct for the single instance this repo deploys today. The lock exists
     * to make a *second* instance safe, not to stop the first from working.
     */
    it('runs the job unconditionally', async () => {
      const job = jest.fn().mockResolvedValue('done');
      await expect(service.withLock('purge', 1000, job)).resolves.toBe('done');
      expect(job).toHaveBeenCalledTimes(1);
    });
  });

  describe('with Redis', () => {
    it('runs the job when it takes the lock', async () => {
      const { port, acquire } = fakeRedis();
      const job = jest.fn().mockResolvedValue('done');

      await expect(
        new LeaderLockService(port).withLock('purge', 5000, job),
      ).resolves.toBe('done');
      expect(acquire).toHaveBeenCalledWith(
        'cron-lock:purge',
        expect.any(String),
        5000,
      );
    });

    /** The ordinary outcome for every instance except one. Not a failure. */
    it('skips the job when another instance holds the lock', async () => {
      const { port, release } = fakeRedis({
        acquire: jest.fn().mockResolvedValue(false),
      });
      const job = jest.fn();

      await expect(
        new LeaderLockService(port).withLock('purge', 5000, job),
      ).resolves.toBeNull();
      expect(job).not.toHaveBeenCalled();
      expect(release).not.toHaveBeenCalled();
    });

    it('releases the lock after the job', async () => {
      const { port, release } = fakeRedis();
      await new LeaderLockService(port).withLock('purge', 5000, () =>
        Promise.resolve('x'),
      );
      expect(release).toHaveBeenCalledWith(
        'cron-lock:purge',
        expect.any(String),
      );
    });

    it('releases the lock even when the job throws', async () => {
      const { port, release } = fakeRedis();

      await expect(
        new LeaderLockService(port).withLock('purge', 5000, () =>
          Promise.reject(new Error('boom')),
        ),
      ).rejects.toThrow('boom');
      expect(release).toHaveBeenCalled();
    });

    /**
     * A lock is released only by its holder. Two processes sharing a value
     * would let one release the other's lock, which reintroduces exactly the
     * concurrency the lock exists to prevent.
     */
    it('identifies itself uniquely per process', async () => {
      const a = fakeRedis();
      const b = fakeRedis();
      await new LeaderLockService(a.port).withLock('x', 1, () =>
        Promise.resolve(1),
      );
      await new LeaderLockService(b.port).withLock('x', 1, () =>
        Promise.resolve(1),
      );

      expect(holderOf(a.acquire)).not.toBe(holderOf(b.acquire));
    });

    it('uses the same holder for acquire and release', async () => {
      const { port, acquire, release } = fakeRedis();
      await new LeaderLockService(port).withLock('purge', 5000, () =>
        Promise.resolve(1),
      );

      expect(holderOf(release)).toBe(holderOf(acquire));
    });

    /**
     * One instance running a job twice is recoverable. Nobody running it at
     * all is a cron that silently stopped — the failure that goes unnoticed.
     */
    it('runs the job unlocked when Redis is unreachable', async () => {
      const { port } = fakeRedis({
        acquire: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      });
      const job = jest.fn().mockResolvedValue('done');

      await expect(
        new LeaderLockService(port).withLock('purge', 5000, job),
      ).resolves.toBe('done');
      expect(job).toHaveBeenCalledTimes(1);
    });

    /** The TTL clears it; failing the completed job over this would be worse. */
    it('does not fail the job when the release fails', async () => {
      const { port } = fakeRedis({
        release: jest.fn().mockRejectedValue(new Error('gone')),
      });

      await expect(
        new LeaderLockService(port).withLock('purge', 5000, () =>
          Promise.resolve('done'),
        ),
      ).resolves.toBe('done');
    });
  });
});
