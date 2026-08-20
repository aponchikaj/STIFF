import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { OrderItem } from '../orders/order-item.entity';
import { FitCounts, FitSummary, FitValue, summarizeFit } from './fit';
import { ProductFitRating } from './product-fit-rating.entity';
import { Product } from './product.entity';
import { PURCHASED_STATUSES } from './purchases';

/** A fit summary plus what the person reading it already said. */
export interface FitReport extends FitSummary {
  /** Their own rating, or null. */
  mine: FitValue | null;
  /** Whether they are allowed to leave one at all. */
  canRate: boolean;
}

@Injectable()
export class FitService {
  constructor(
    @InjectRepository(ProductFitRating)
    private readonly fitRepo: Repository<ProductFitRating>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Which of these people bought this product.
   *
   * One query for the whole comment page rather than one per comment — the
   * naive version is N+1 against the largest table in the shop.
   */
  async buyersAmong(
    productId: string,
    userIds: string[],
  ): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const rows = await this.orderItemRepo
      .createQueryBuilder('item')
      .select('DISTINCT order."userId"', 'userId')
      .innerJoin('orders', 'order', 'order."id" = item."orderId"')
      .where('item."productId" = :productId', { productId })
      .andWhere('order."userId" IN (:...userIds)', { userIds })
      .andWhere('order."status" IN (:...statuses)', {
        statuses: [...PURCHASED_STATUSES],
      })
      .getRawMany<{ userId: string }>();
    return new Set(rows.map((row) => row.userId));
  }

  /** The sizes this person actually bought, newest first. */
  async purchasedSizes(productId: string, userId: string): Promise<string[]> {
    const rows = await this.orderItemRepo
      .createQueryBuilder('item')
      .select('item."size"', 'size')
      .addSelect('MAX(order."createdAt")', 'latest')
      .innerJoin('orders', 'order', 'order."id" = item."orderId"')
      .where('item."productId" = :productId', { productId })
      .andWhere('order."userId" = :userId', { userId })
      .andWhere('order."status" IN (:...statuses)', {
        statuses: [...PURCHASED_STATUSES],
      })
      .groupBy('item."size"')
      .orderBy('MAX(order."createdAt")', 'DESC')
      .getRawMany<{ size: string }>();
    return rows.map((row) => row.size);
  }

  /** The tallies as the product row carries them. */
  countsOf(product: {
    fitSmallCount?: number;
    fitTrueCount?: number;
    fitLargeCount?: number;
  }): FitCounts {
    return {
      small: product.fitSmallCount ?? 0,
      true: product.fitTrueCount ?? 0,
      large: product.fitLargeCount ?? 0,
    };
  }

  async reportFor(product: Product, userId?: string): Promise<FitReport> {
    const summary = summarizeFit(this.countsOf(product));
    if (!userId) return { ...summary, mine: null, canRate: false };

    const [mine, sizes] = await Promise.all([
      this.fitRepo.findOne({ where: { productId: product.id, userId } }),
      this.purchasedSizes(product.id, userId),
    ]);
    return {
      ...summary,
      mine: mine?.value ?? null,
      // Already rated counts as allowed, so the control stays on screen for
      // someone changing their mind.
      canRate: sizes.length > 0 || mine !== null,
    };
  }

  /**
   * Records or replaces one person's reading.
   *
   * Gated on having bought the thing. That is the whole reason this rating is
   * worth showing: five stars from someone who never wore it says nothing
   * about how it fits.
   */
  async rate(
    productId: string,
    userId: string,
    value: FitValue,
  ): Promise<FitReport> {
    const sizes = await this.purchasedSizes(productId, userId);
    const existing = await this.fitRepo.findOne({
      where: { productId, userId },
    });
    if (sizes.length === 0 && !existing) {
      throw new ForbiddenException(
        'Only people who bought this piece can rate its fit',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ProductFitRating);
      if (existing) {
        existing.value = value;
        existing.size = sizes[0] ?? existing.size;
        await repo.save(existing);
      } else {
        await repo.save(
          repo.create({ productId, userId, value, size: sizes[0] ?? '' }),
        );
      }
      const product = await this.syncCounts(manager, productId);
      return this.reportFor(product, userId);
    });
  }

  async remove(productId: string, userId: string): Promise<FitReport> {
    return this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(ProductFitRating)
        .delete({ productId, userId });
      const product = await this.syncCounts(manager, productId);
      return this.reportFor(product, userId);
    });
  }

  /**
   * Recounts from the ratings table and writes the three columns.
   *
   * Recounted rather than incremented, exactly like `ReactionsService`: a
   * counter that drifts is worse than a counter that costs one extra query on
   * a rare write.
   */
  private async syncCounts(
    manager: DataSource['manager'],
    productId: string,
  ): Promise<Product> {
    const rows = await manager
      .getRepository(ProductFitRating)
      .find({ where: { productId }, select: { value: true } });
    const counts = {
      fitSmallCount: rows.filter((r) => r.value === -1).length,
      fitTrueCount: rows.filter((r) => r.value === 0).length,
      fitLargeCount: rows.filter((r) => r.value === 1).length,
    };
    await manager.getRepository(Product).update({ id: productId }, counts);
    return manager
      .getRepository(Product)
      .findOneOrFail({ where: { id: productId } });
  }

  /** Archive shots featuring a piece, for "Seen in the archive". */
  async archiveShotsFor(productId: string) {
    return this.dataSource
      .createQueryBuilder()
      .select([
        'item."id" AS "id"',
        'item."slug" AS "slug"',
        'item."title" AS "title"',
        'item."altText" AS "altText"',
        'item."imageUrl" AS "imageUrl"',
        'item."width" AS "width"',
        'item."height" AS "height"',
        'item."rotation" AS "rotation"',
      ])
      .from('gallery_items', 'item')
      .innerJoin(
        'gallery_item_products',
        'link',
        'link."galleryItemId" = item."id"',
      )
      .where('link."productId" = :productId', { productId })
      .andWhere('item."isArchived" = false')
      .orderBy('item."sortOrder"', 'ASC')
      .addOrderBy('item."createdAt"', 'DESC')
      .limit(12)
      .getRawMany();
  }

  /** The same lookup for a page of products, without N+1. */
  async archiveShotCounts(productIds: string[]): Promise<Map<string, number>> {
    if (productIds.length === 0) return new Map();
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('link."productId"', 'productId')
      .addSelect('COUNT(*)::int', 'count')
      .from('gallery_item_products', 'link')
      .where('link."productId" IN (:...productIds)', { productIds })
      .groupBy('link."productId"')
      .getRawMany<{ productId: string; count: number }>();
    return new Map(rows.map((row) => [row.productId, row.count]));
  }

  /** Products worn in a set of archive shots, for the admin editor. */
  async productsFor(galleryItemId: string): Promise<Product[]> {
    return this.dataSource
      .getRepository(Product)
      .createQueryBuilder('product')
      .innerJoin(
        'gallery_item_products',
        'link',
        'link."productId" = product."id"',
      )
      .where('link."galleryItemId" = :galleryItemId', { galleryItemId })
      .orderBy('product."name"', 'ASC')
      .getMany();
  }

  /** Replaces a shot's product links with exactly what the admin submitted. */
  async setProductsFor(
    galleryItemId: string,
    productIds: string[],
  ): Promise<void> {
    const wanted = [...new Set(productIds)];
    await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .delete()
        .from('gallery_item_products')
        .where('"galleryItemId" = :galleryItemId', { galleryItemId })
        .execute();
      if (wanted.length === 0) return;

      // Only ids that resolve — a stale id from a stale admin tab would
      // otherwise fail the whole save on a foreign key.
      const live = await manager
        .getRepository(Product)
        .find({ where: { id: In(wanted) }, select: { id: true } });
      if (live.length === 0) return;

      await manager
        .createQueryBuilder()
        .insert()
        .into('gallery_item_products', ['galleryItemId', 'productId'])
        .values(
          live.map((product) => ({ galleryItemId, productId: product.id })),
        )
        .orIgnore()
        .execute();
    });
  }
}
