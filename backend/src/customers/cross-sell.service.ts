import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrderItem } from '../orders/order-item.entity';
import { Product } from '../products/product.entity';

interface CachedPairs {
  computedAt: number;
  /** productId -> co-purchased productIds, most frequent first. */
  pairs: Map<string, string[]>;
}

/** Recomputed nightly; a day-stale suggestion is still a good suggestion. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_SUGGESTIONS = 4;

@Injectable()
export class CrossSellService {
  private readonly logger = new Logger(CrossSellService.name);
  private cache: CachedPairs | null = null;

  constructor(
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  /**
   * "Goes with", from what people actually bought together.
   *
   * One self-join over order_items rather than anything cleverer — with a
   * catalogue this size the honest co-purchase count beats a recommender, and
   * it needs no data the shop does not already have.
   */
  private async computePairs(): Promise<Map<string, string[]>> {
    const rows = await this.orderItemRepo.query<
      { a: string; b: string; count: number }[]
    >(`
      SELECT a."productId" AS a, b."productId" AS b, COUNT(*)::int AS count
      FROM "order_items" a
      JOIN "order_items" b
        ON a."orderId" = b."orderId" AND a."productId" <> b."productId"
      JOIN "orders" o ON o."id" = a."orderId"
      WHERE a."productId" IS NOT NULL
        AND b."productId" IS NOT NULL
        -- A cancelled order is not evidence that two things go together.
        AND o."status" <> 'cancelled'
      GROUP BY a."productId", b."productId"
      ORDER BY count DESC
    `);

    const pairs = new Map<string, string[]>();
    for (const row of rows) {
      const list = pairs.get(row.a) ?? [];
      if (list.length < MAX_SUGGESTIONS) {
        list.push(row.b);
        pairs.set(row.a, list);
      }
    }
    return pairs;
  }

  async refresh(): Promise<number> {
    const pairs = await this.computePairs();
    this.cache = { computedAt: Date.now(), pairs };
    this.logger.log(`Cross-sell pairs refreshed for ${pairs.size} products`);
    return pairs.size;
  }

  private async pairs(): Promise<Map<string, string[]>> {
    if (!this.cache || Date.now() - this.cache.computedAt > CACHE_TTL_MS) {
      await this.refresh();
    }
    return this.cache!.pairs;
  }

  /**
   * Suggestions for what is already in a cart.
   *
   * Anything already in the cart is excluded — suggesting what someone has
   * just added is the fastest way to look broken.
   */
  async suggestFor(productIds: string[]): Promise<Product[]> {
    if (productIds.length === 0) return [];
    const pairs = await this.pairs();

    const inCart = new Set(productIds);
    const scores = new Map<string, number>();
    for (const id of productIds) {
      (pairs.get(id) ?? []).forEach((other, rank) => {
        if (inCart.has(other)) return;
        // Earlier in a product's list means more often bought alongside it.
        scores.set(other, (scores.get(other) ?? 0) + (MAX_SUGGESTIONS - rank));
      });
    }
    if (scores.size === 0) return [];

    const ranked = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_SUGGESTIONS)
      .map(([id]) => id);

    const products = await this.productRepo.find({
      where: { id: In(ranked), isActive: true },
    });
    // Re-apply the ranking the database threw away.
    const order = new Map(ranked.map((id, i) => [id, i]));
    return products.sort(
      (a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99),
    );
  }
}
