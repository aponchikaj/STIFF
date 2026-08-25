import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { OrderItem } from '../orders/order-item.entity';
import { Product } from './product.entity';
import { PURCHASED_STATUSES } from './purchases';

/**
 * The ties between products and the rest of the site: who has actually bought
 * a piece, and which archive shots it appears in.
 */
@Injectable()
export class ProductLinksService {
  constructor(
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
