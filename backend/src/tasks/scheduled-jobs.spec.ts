import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuthService } from '../auth/auth.service';
import { TokenService } from '../auth/token.service';
import { CartItem } from '../cart/cart-item.entity';
import { CartService } from '../cart/cart.service';
import { LeaderLockService } from '../common/redis/leader-lock.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';
import { TasksService } from './tasks.service';

/**
 * Scheduled jobs, and the lock in front of them.
 *
 * `@nestjs/schedule` fires every `@Cron` on every process that boots. That is
 * the intent with one instance and a bug with two — three processes mean three
 * analytics snapshots, three token purges, and three abandoned-cart emails to
 * the same person. The lock is what makes a second instance safe; these tests
 * hold that every job actually goes through it.
 */
/** The (name, ttl) a `withLock` call was made with, typed for lint. */
function lockArgs(withLock: jest.Mock): { name: string; ttlMs: number } {
  const [name, ttlMs] = withLock.mock.calls[0] as [string, number];
  return { name, ttlMs };
}

describe('TasksService scheduling', () => {
  let service: TasksService;
  let withLock: jest.Mock;
  let tokenService: { purgeStale: jest.Mock };
  let productsService: { openScheduledDrops: jest.Mock };

  beforeEach(async () => {
    // Runs the job, so each test also exercises the body it wraps.
    withLock = jest.fn(
      async (_name: string, _ttl: number, job: () => Promise<unknown>) =>
        await job(),
    );
    tokenService = { purgeStale: jest.fn().mockResolvedValue(0) };
    productsService = { openScheduledDrops: jest.fn().mockResolvedValue(0) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: TokenService, useValue: tokenService },
        {
          provide: AuthService,
          useValue: { purgeStaleEmailTokens: jest.fn().mockResolvedValue(0) },
        },
        {
          provide: UsersService,
          useValue: { deleteStaleUnverified: jest.fn().mockResolvedValue(0) },
        },
        {
          provide: AnalyticsService,
          useValue: {
            snapshotDay: jest.fn().mockResolvedValue({ date: '2026-09-05' }),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            notify: jest.fn(),
            recentlyNotifiedUserIds: jest.fn().mockResolvedValue(new Set()),
          },
        },
        {
          provide: getRepositoryToken(CartItem),
          useValue: {
            createQueryBuilder: jest.fn(() => {
              const qb: Record<string, jest.Mock> = {};
              for (const m of [
                'select',
                'addSelect',
                'where',
                'groupBy',
                'having',
              ]) {
                qb[m] = jest.fn(() => qb);
              }
              qb.getRawMany = jest.fn().mockResolvedValue([]);
              return qb;
            }),
          },
        },
        {
          provide: CartService,
          useValue: { purgeStaleGuestCarts: jest.fn().mockResolvedValue(0) },
        },
        { provide: ProductsService, useValue: productsService },
        { provide: LeaderLockService, useValue: { withLock } },
      ],
    }).compile();

    service = module.get(TasksService);
  });

  const jobs: [string, () => Promise<void>][] = [];

  beforeEach(() => {
    jobs.length = 0;
    jobs.push(
      ['purgeStaleTokens', () => service.purgeStaleTokens()],
      ['openScheduledDrops', () => service.openScheduledDrops()],
      ['deleteStaleUnverified', () => service.deleteStaleUnverified()],
      ['purgeStaleGuestCarts', () => service.purgeStaleGuestCarts()],
      ['abandonedCartReminders', () => service.abandonedCartReminders()],
      ['snapshotYesterday', () => service.snapshotYesterday()],
    );
  });

  /** The assertion that matters: no job may bypass the lock. */
  it('runs every scheduled job through the leader lock', async () => {
    for (const [name, run] of jobs) {
      withLock.mockClear();
      await run();
      expect(withLock).toHaveBeenCalledTimes(1);
      expect(lockArgs(withLock).name).toBe(name);
    }
  });

  it('gives every job a lock TTL longer than a moment', async () => {
    for (const [, run] of jobs) {
      withLock.mockClear();
      await run();
      expect(lockArgs(withLock).ttlMs).toBeGreaterThanOrEqual(50_000);
    }
  });

  /**
   * The minute-by-minute job is the one case where the TTL must stay under the
   * tick interval — otherwise a run that hangs would block every later tick
   * until it expired, and the drop it was opening would sit closed.
   */
  it('keeps the per-minute job lock shorter than its interval', async () => {
    await service.openScheduledDrops();
    expect(lockArgs(withLock).ttlMs).toBeLessThan(60_000);
  });

  it('still does the work when it holds the lock', async () => {
    await service.purgeStaleTokens();
    expect(tokenService.purgeStale).toHaveBeenCalled();

    await service.openScheduledDrops();
    expect(productsService.openScheduledDrops).toHaveBeenCalled();
  });

  /** Another instance held it. Ordinary, and not an error. */
  it('does no work when it does not hold the lock', async () => {
    withLock.mockResolvedValue(null);
    await service.purgeStaleTokens();
    expect(tokenService.purgeStale).not.toHaveBeenCalled();
  });

  /**
   * An unhandled rejection inside a `@Cron` handler takes the process down.
   * Every job has to swallow its own failure and log it instead.
   */
  it('never lets a job throw into the scheduler', async () => {
    withLock.mockRejectedValue(new Error('redis exploded'));
    for (const [, run] of jobs) {
      await expect(run()).resolves.toBeUndefined();
    }
  });
});
