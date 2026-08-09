import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated } from '../common/types/paginated';
import { UsersService } from '../users/users.service';
import { ListNotificationsQueryDto } from './dto/notifications.dto';
import {
  Notification,
  NotificationMeta,
  NotificationType,
} from './notification.entity';

const BROADCAST_CHUNK = 500;

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly usersService: UsersService,
  ) {}

  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    meta?: NotificationMeta,
  ): Promise<void> {
    await this.notificationRepo.save(
      this.notificationRepo.create({
        userId,
        type,
        title,
        body,
        meta: meta ?? null,
      }),
    );
  }

  async list(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<Paginated<Notification> & { unreadCount: number }> {
    const where = query.unreadOnly ? { userId, isRead: false } : { userId };
    const [items, total] = await this.notificationRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.pageSize,
    });
    const unreadCount = await this.notificationRepo.count({
      where: { userId, isRead: false },
    });
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      unreadCount,
    };
  }

  async markRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id, userId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (!notification.isRead) {
      notification.isRead = true;
      await this.notificationRepo.save(notification);
    }
    return notification;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.notificationRepo.update(
      { userId, isRead: false },
      { isRead: true },
    );
    return result.affected ?? 0;
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.notificationRepo.delete({ id, userId });
    if (!result.affected) throw new NotFoundException('Notification not found');
  }

  async broadcast(title: string, body: string): Promise<number> {
    const userIds = await this.usersService.allActiveUserIds();
    for (let i = 0; i < userIds.length; i += BROADCAST_CHUNK) {
      const chunk = userIds.slice(i, i + BROADCAST_CHUNK);
      await this.notificationRepo.insert(
        chunk.map((userId) => ({
          userId,
          type: 'broadcast' as const,
          title,
          body,
          meta: null,
        })),
      );
    }
    return userIds.length;
  }

  /**
   * Users among `userIds` who already received a notification with `title`
   * within the last `days` days — used to dedupe cron reminders.
   */
  async recentlyNotifiedUserIds(
    userIds: string[],
    title: string,
    days: number,
  ): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.notificationRepo
      .createQueryBuilder('n')
      .select('DISTINCT n.userId', 'userId')
      .where('n.userId IN (:...userIds)', { userIds })
      .andWhere('n.title = :title', { title })
      .andWhere('n.createdAt > :cutoff', { cutoff })
      .getRawMany<{ userId: string }>();
    return new Set(rows.map((r) => r.userId));
  }
}
