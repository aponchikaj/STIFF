import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuthService } from '../auth/auth.service';
import { TokenService } from '../auth/token.service';
import { CartItem } from '../cart/cart-item.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

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
  ) {}

  /** Hourly: purge expired/used auth tokens so the tables stay small. */
  @Cron('0 * * * *')
  async purgeStaleTokens(): Promise<void> {
    try {
      const refresh = await this.tokenService.purgeStale();
      const email = await this.authService.purgeStaleEmailTokens();
      if (refresh || email) {
        this.logger.log(
          `Purged ${refresh} refresh tokens, ${email} email tokens`,
        );
      }
    } catch (err) {
      this.logger.error('purgeStaleTokens failed', this.stack(err));
    }
  }

  /** Daily 03:00: remove week-old unverified accounts with no orders. */
  @Cron('0 3 * * *')
  async deleteStaleUnverified(): Promise<void> {
    try {
      const deleted = await this.usersService.deleteStaleUnverified(7);
      if (deleted) this.logger.log(`Deleted ${deleted} stale unverified users`);
    } catch (err) {
      this.logger.error('deleteStaleUnverified failed', this.stack(err));
    }
  }

  /** Daily 03:30: nudge users whose cart went quiet 3–4 days ago. */
  @Cron('30 3 * * *')
  async abandonedCartReminders(): Promise<void> {
    try {
      const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      const rows = await this.cartRepo
        .createQueryBuilder('cart')
        .select('cart.userId', 'userId')
        .addSelect('MAX(cart.updatedAt)', 'last')
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
    } catch (err) {
      this.logger.error('abandonedCartReminders failed', this.stack(err));
    }
  }

  /** Daily 00:05: freeze yesterday's analytics into a snapshot row. */
  @Cron('5 0 * * *')
  async snapshotYesterday(): Promise<void> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const snapshot = await this.analyticsService.snapshotDay(yesterday);
      this.logger.log(`Analytics snapshot saved for ${snapshot.date}`);
    } catch (err) {
      this.logger.error('snapshotYesterday failed', this.stack(err));
    }
  }

  private stack(err: unknown): string | undefined {
    return err instanceof Error ? err.stack : String(err);
  }
}
