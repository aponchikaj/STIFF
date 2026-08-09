import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { ContactMessage } from '../contact/contact-message.entity';
import { OrderItem } from '../orders/order-item.entity';
import { Order } from '../orders/order.entity';
import { Product } from '../products/product.entity';
import { Comment } from '../comments/comment.entity';
import { User } from '../users/user.entity';
import { AnalyticsSnapshot } from './analytics-snapshot.entity';

const REVENUE_STATUSES = ['paid', 'shipped', 'delivered'];

export type TimeseriesMetric = 'revenue' | 'orders' | 'signups';

export interface AnalyticsOverview {
  totalRevenueCents: number;
  totalOrders: number;
  totalUsers: number;
  totalProducts: number;
  pendingContacts: number;
  revenueThisMonthCents: number;
  signupsThisMonth: number;
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsSnapshot)
    private readonly snapshotRepo: Repository<AnalyticsSnapshot>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(ContactMessage)
    private readonly contactRepo: Repository<ContactMessage>,
  ) {}

  async overview(): Promise<AnalyticsOverview> {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      totalRevenue,
      totalOrders,
      totalUsers,
      totalProducts,
      pendingContacts,
      monthRevenue,
      signupsThisMonth,
    ] = await Promise.all([
      this.sumRevenue(),
      this.orderRepo.count(),
      this.userRepo.count(),
      this.productRepo.count(),
      this.contactRepo.count({ where: { isHandled: false } }),
      this.sumRevenue(monthStart),
      this.userRepo
        .createQueryBuilder('user')
        .where('user.createdAt >= :monthStart', { monthStart })
        .getCount(),
    ]);

    return {
      totalRevenueCents: totalRevenue,
      totalOrders,
      totalUsers,
      totalProducts,
      pendingContacts,
      revenueThisMonthCents: monthRevenue,
      signupsThisMonth,
    };
  }

  async timeseries(
    from: string,
    to: string,
    metric: TimeseriesMetric,
  ): Promise<{ points: { date: string; value: number }[] }> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new BadRequestException('from/to must be YYYY-MM-DD');
    }

    const snapshots = await this.snapshotRepo.find({
      where: { date: Between(from, to) },
      order: { date: 'ASC' },
    });

    const column: Record<TimeseriesMetric, keyof AnalyticsSnapshot> = {
      revenue: 'revenueCents',
      orders: 'ordersCount',
      signups: 'signupsCount',
    };

    const points = snapshots.map((s) => ({
      date: s.date,
      value: s[column[metric]] as number,
    }));

    // Append today's live numbers if the range includes today.
    const todayKey = toDateKey(new Date());
    if (from <= todayKey && todayKey <= to) {
      const live = await this.computeDay(new Date());
      const value =
        metric === 'revenue'
          ? live.revenueCents
          : metric === 'orders'
            ? live.ordersCount
            : live.signupsCount;
      const existing = points.find((p) => p.date === todayKey);
      if (existing) existing.value = value;
      else points.push({ date: todayKey, value });
    }

    return { points };
  }

  async topProducts(limit = 5): Promise<{
    items: {
      productId: string | null;
      name: string;
      unitsSold: number;
      revenueCents: number;
    }[];
  }> {
    const rows = await this.orderItemRepo
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .select('item.productId', 'productId')
      .addSelect('MAX(item.productName)', 'name')
      .addSelect('SUM(item.quantity)', 'unitsSold')
      .addSelect('SUM(item.quantity * item.unitPriceCents)', 'revenueCents')
      .where('order.status IN (:...statuses)', { statuses: REVENUE_STATUSES })
      .groupBy('item.productId')
      .orderBy('"revenueCents"', 'DESC')
      .limit(Math.min(Math.max(limit, 1), 50))
      .getRawMany<{
        productId: string | null;
        name: string;
        unitsSold: string;
        revenueCents: string;
      }>();

    return {
      items: rows.map((r) => ({
        productId: r.productId,
        name: r.name,
        unitsSold: Number(r.unitsSold),
        revenueCents: Number(r.revenueCents),
      })),
    };
  }

  /** Compute aggregates for the calendar day containing `date`. */
  async computeDay(date: Date): Promise<{
    date: string;
    revenueCents: number;
    ordersCount: number;
    signupsCount: number;
    newCommentsCount: number;
  }> {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const [revenueRow, ordersCount, signupsCount, newCommentsCount] =
      await Promise.all([
        this.orderRepo
          .createQueryBuilder('order')
          .select('COALESCE(SUM(order.totalCents), 0)', 'total')
          .where('order.createdAt >= :start AND order.createdAt < :end', {
            start,
            end,
          })
          .andWhere('order.status IN (:...statuses)', {
            statuses: REVENUE_STATUSES,
          })
          .getRawOne<{ total: string }>(),
        this.orderRepo
          .createQueryBuilder('order')
          .where('order.createdAt >= :start AND order.createdAt < :end', {
            start,
            end,
          })
          .getCount(),
        this.userRepo
          .createQueryBuilder('user')
          .where('user.createdAt >= :start AND user.createdAt < :end', {
            start,
            end,
          })
          .getCount(),
        this.commentRepo
          .createQueryBuilder('comment')
          .where('comment.createdAt >= :start AND comment.createdAt < :end', {
            start,
            end,
          })
          .getCount(),
      ]);

    return {
      date: toDateKey(start),
      revenueCents: Number(revenueRow?.total ?? 0),
      ordersCount,
      signupsCount,
      newCommentsCount,
    };
  }

  /** Upsert the snapshot row for the given day (cron). */
  async snapshotDay(date: Date): Promise<AnalyticsSnapshot> {
    const computed = await this.computeDay(date);
    const existing = await this.snapshotRepo.findOne({
      where: { date: computed.date },
    });
    if (existing) {
      Object.assign(existing, computed);
      return this.snapshotRepo.save(existing);
    }
    return this.snapshotRepo.save(this.snapshotRepo.create(computed));
  }

  private async sumRevenue(since?: Date): Promise<number> {
    const qb = this.orderRepo
      .createQueryBuilder('order')
      .select('COALESCE(SUM(order.totalCents), 0)', 'total')
      .where('order.status IN (:...statuses)', {
        statuses: REVENUE_STATUSES,
      });
    if (since) qb.andWhere('order.createdAt >= :since', { since });
    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }
}
