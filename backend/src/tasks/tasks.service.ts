import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuthService } from '../auth/auth.service';
import { TokenService } from '../auth/token.service';
import { CartItem } from '../cart/cart-item.entity';
import { CartService } from '../cart/cart.service';
import { ProductsService } from '../products/products.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { LeaderLockService } from '../common/redis/leader-lock.service';

const CART_REMINDER_TITLE = 'You left something in your cart';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly analyticsService: AnalyticsService,
    private readonly notificationsService: NotificationsService,
    @InjectRepository(CartItem)
    private readonly cartRepo: Repository<CartItem>,
    private readonly cartService: CartService,
    private readonly productsService: ProductsService,
    private readonly leaderLock: LeaderLockService,
  ) {}

  /**
   * Runs a scheduled job on one instance, and only reports what it did there.
   *
   * `@nestjs/schedule` fires every `@Cron` on every process that boots. With
   * one instance that is the intent; with three it means three analytics
   * snapshots, three token purges, and three abandoned-cart emails to the same
   * person — the last of which a customer notices.
   *
   * `withLock` returns null when another instance held the lock, which is the
   * ordinary outcome and not worth a log line. Errors are caught here rather
   * than in each job so a throw can never escape into the scheduler, where an
   * unhandled rejection would take the process down.
   */
  private async scheduled(
    name: string,
    ttlMs: number,
    job: () => Promise<void>,
  ): Promise<void> {
    try {
      await this.leaderLock.withLock(name, ttlMs, job);
    } catch (err) {
      this.logger.error(`${name} failed`, this.stack(err));
    }
  }

  /** Hourly: purge expired/used auth tokens so the tables stay small. */
  @Cron('0 * * * *')
  async purgeStaleTokens(): Promise<void> {
    await this.scheduled('purgeStaleTokens', 5 * 60_000, async () => {
      const refresh = await this.tokenService.purgeStale();
      const email = await this.authService.purgeStaleEmailTokens();
      if (refresh || email) {
        this.logger.log(
          `Purged ${refresh} refresh tokens, ${email} email tokens`,
        );
      }
    });
  }

  /**
   * Every minute: open drops whose moment has arrived.
   *
   * Browsing already hides an unpublished product, so this only tidies the
   * timestamp — a missed run delays no drop, it just leaves the flag set.
   */
  @Cron('* * * * *')
  async openScheduledDrops(): Promise<void> {
    await this.scheduled('openScheduledDrops', 50_000, async () => {
      const opened = await this.productsService.openScheduledDrops();
      if (opened) this.logger.log(`Opened ${opened} scheduled drop(s)`);
    });
  }

  /** Daily 03:00: remove week-old unverified accounts with no orders. */
  @Cron('0 3 * * *')
  async deleteStaleUnverified(): Promise<void> {
    await this.scheduled('deleteStaleUnverified', 5 * 60_000, async () => {
      const deleted = await this.usersService.deleteStaleUnverified(7);
      if (deleted) this.logger.log(`Deleted ${deleted} stale unverified users`);
    });
  }

  /**
   * Daily 03:15: drop anonymous carts nobody came back to.
   *
   * A guest cart is only reachable through its cookie, and that cookie expires
   * after 60 days — rows outliving it are unreachable by anyone.
   */
  @Cron('15 3 * * *')
  async purgeStaleGuestCarts(): Promise<void> {
    await this.scheduled('purgeStaleGuestCarts', 5 * 60_000, async () => {
      const deleted = await this.cartService.purgeStaleGuestCarts(60);
      if (deleted) this.logger.log(`Purged ${deleted} stale guest cart rows`);
    });
  }

  /** Daily 03:30: nudge users whose cart went quiet 3–4 days ago. */
  @Cron('30 3 * * *')
  async abandonedCartReminders(): Promise<void> {
    await this.scheduled('abandonedCartReminders', 10 * 60_000, async () => {
      const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      const rows = await this.cartRepo
        .createQueryBuilder('cart')
        .select('cart.userId', 'userId')
        .addSelect('MAX(cart.updatedAt)', 'last')
        // Guest rows have no account to notify.
        .where('cart.userId IS NOT NULL')
        .groupBy('cart.userId')
        .having('MAX(cart.updatedAt) BETWEEN :from AND :to', {
          from: fourDaysAgo,
          to: threeDaysAgo,
        })
        .getRawMany<{ userId: string }>();

      const userIds = rows.map((r) => r.userId);
      if (userIds.length === 0) return;

      const alreadyNotified =
        await this.notificationsService.recentlyNotifiedUserIds(
          userIds,
          CART_REMINDER_TITLE,
          7,
        );

      let sent = 0;
      for (const userId of userIds) {
        if (alreadyNotified.has(userId)) continue;
        await this.notificationsService.notify(
          userId,
          'system',
          CART_REMINDER_TITLE,
          'Your picks are still waiting — complete your order before they sell out.',
        );
        sent++;
      }
      if (sent) this.logger.log(`Sent ${sent} abandoned-cart reminders`);
    });
  }

  /** Daily 00:05: freeze yesterday's analytics into a snapshot row. */
  @Cron('5 0 * * *')
  async snapshotYesterday(): Promise<void> {
    await this.scheduled('snapshotYesterday', 5 * 60_000, async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const snapshot = await this.analyticsService.snapshotDay(yesterday);
      this.logger.log(`Analytics snapshot saved for ${snapshot.date}`);
    });
  }

  private stack(err: unknown): string | undefined {
    return err instanceof Error ? err.stack : String(err);
  }
}
