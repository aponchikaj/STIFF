import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProductVariant } from '../products/product-variant.entity';
import { Product } from '../products/product.entity';
import { SubscribeStockDto } from './dto/customers.dto';
import { StockAlert } from './stock-alert.entity';

@Injectable()
export class StockAlertsService {
  private readonly logger = new Logger(StockAlertsService.name);

  constructor(
    @InjectRepository(StockAlert)
    private readonly alertRepo: Repository<StockAlert>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Subscribe to a size that is currently gone.
   *
   * Refuses when the size is actually in stock: the customer can just buy it,
   * and an alert that fires immediately looks broken.
   */
  async subscribe(
    dto: SubscribeStockDto,
    owner: { userId: string | null; email: string | null },
  ): Promise<{ subscribed: true }> {
    const variant = await this.variantRepo.findOne({
      where: { id: dto.variantId },
    });
    if (!variant) throw new BadRequestException('That size does not exist.');
    if (variant.stock > 0 && variant.isActive) {
      throw new BadRequestException('That size is in stock right now.');
    }
    if (!owner.userId && !owner.email) {
      throw new BadRequestException('Leave an email so we can tell you.');
    }

    const where = owner.userId
      ? { variantId: variant.id, userId: owner.userId, notifiedAt: IsNull() }
      : {
          variantId: variant.id,
          email: owner.email!.toLowerCase(),
          notifiedAt: IsNull(),
        };
    const existing = await this.alertRepo.findOne({ where });
    if (existing) return { subscribed: true };

    await this.alertRepo.save(
      this.alertRepo.create({
        variantId: variant.id,
        userId: owner.userId,
        email: owner.userId ? null : owner.email!.toLowerCase(),
      }),
    );
    return { subscribed: true };
  }

  /**
   * Tells everyone waiting on sizes that are back.
   *
   * Runs on a schedule rather than firing at the moment stock moves: a restock
   * often means several variants changing in a row, and a customer should get
   * one message, not one per save. Marking `notifiedAt` is what prevents a
   * repeat — and it frees the unique index so they can subscribe again next
   * time.
   */
  async notifyRestocked(): Promise<number> {
    const pending = await this.alertRepo.find({
      where: { notifiedAt: IsNull() },
      relations: { variant: true },
      take: 500,
    });
    const back = pending.filter(
      (alert) =>
        alert.variant && alert.variant.isActive && alert.variant.stock > 0,
    );
    if (back.length === 0) return 0;

    const productIds = [...new Set(back.map((a) => a.variant.productId))];
    const products = await this.productRepo.find({
      where: { id: In(productIds) },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    let sent = 0;
    for (const alert of back) {
      const product = byId.get(alert.variant.productId);
      if (!product) continue;
      const label = alert.variant.size
        ? `${product.name} (${alert.variant.size})`
        : product.name;

      try {
        if (alert.userId) {
          await this.notificationsService.notify(
            alert.userId,
            'system',
            'Back in stock',
            `${label} is available again.`,
          );
        }
        const email = alert.email;
        if (email) {
          void this.mailService.sendBackInStock(email, label, product.slug);
        }
        alert.notifiedAt = new Date();
        await this.alertRepo.save(alert);
        sent++;
      } catch (err) {
        this.logger.error(
          `Failed to notify stock alert ${alert.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
    if (sent) this.logger.log(`Sent ${sent} back-in-stock alerts`);
    return sent;
  }

  /** How many people are waiting on each size — demand the admin can see. */
  async pendingCounts(productId: string): Promise<Record<string, number>> {
    const rows = await this.alertRepo
      .createQueryBuilder('alert')
      .innerJoin('product_variants', 'v', 'v.id = alert.variantId')
      .select('v.size', 'size')
      .addSelect('COUNT(*)::int', 'count')
      .where('v."productId" = :productId', { productId })
      .andWhere('alert."notifiedAt" IS NULL')
      .groupBy('v.size')
      .getRawMany<{ size: string; count: number }>();
    return Object.fromEntries(rows.map((r) => [r.size, r.count]));
  }

  /** Housekeeping: alerts sent long ago are just history. */
  async purgeNotified(olderThanDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await this.alertRepo
      .createQueryBuilder()
      .delete()
      .where('"notifiedAt" IS NOT NULL')
      .andWhere('"notifiedAt" < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }
}
