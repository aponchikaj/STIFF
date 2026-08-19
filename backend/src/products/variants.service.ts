import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { ProductVariant } from './product-variant.entity';
import { Product } from './product.entity';
import {
  NormalizedVariant,
  ONE_SIZE,
  VariantInput,
  normalizeVariants,
  sumStock,
} from './stock';

@Injectable()
export class VariantsService {
  constructor(
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
  ) {}

  listFor(productId: string): Promise<ProductVariant[]> {
    return this.variantRepo.find({
      where: { productId },
      order: { position: 'ASC' },
    });
  }

  async listForMany(
    productIds: string[],
  ): Promise<Map<string, ProductVariant[]>> {
    if (productIds.length === 0) return new Map();
    const rows = await this.variantRepo.find({
      where: { productId: In(productIds) },
      order: { position: 'ASC' },
    });
    const byProduct = new Map<string, ProductVariant[]>();
    for (const row of rows) {
      const list = byProduct.get(row.productId) ?? [];
      list.push(row);
      byProduct.set(row.productId, list);
    }
    return byProduct;
  }

  /**
   * Replaces a product's variants with exactly what the admin submitted.
   *
   * Rows are matched by size rather than id, so an admin can retype a form
   * without orphaning stock. A size that disappears is deleted only when
   * nothing references it; otherwise it is deactivated, because deleting it
   * would blank the size on historical order lines.
   */
  async replaceFor(
    manager: EntityManager,
    product: Product,
    input: VariantInput[] | undefined,
  ): Promise<ProductVariant[]> {
    const repo = manager.getRepository(ProductVariant);
    const existing = await repo.find({ where: { productId: product.id } });
    const wanted = this.normalizeOrDefault(input, existing);

    const bySize = new Map(existing.map((v) => [v.size, v]));
    const kept: ProductVariant[] = [];

    for (const next of wanted) {
      const current = bySize.get(next.size);
      if (current) {
        current.sku = next.sku;
        current.stock = next.stock;
        current.priceDeltaCents = next.priceDeltaCents;
        current.position = next.position;
        current.isActive = next.isActive;
        kept.push(await repo.save(current));
        bySize.delete(next.size);
      } else {
        kept.push(
          await repo.save(
            repo.create({
              productId: product.id,
              size: next.size,
              sku: next.sku,
              stock: next.stock,
              priceDeltaCents: next.priceDeltaCents,
              position: next.position,
              isActive: next.isActive,
            }),
          ),
        );
      }
    }

    // Whatever the admin dropped.
    for (const orphan of bySize.values()) {
      const referenced = await manager.query<{ count: string }[]>(
        `SELECT COUNT(*)::text AS count FROM "order_items" WHERE "variantId" = $1`,
        [orphan.id],
      );
      if (Number(referenced[0]?.count ?? 0) > 0) {
        orphan.isActive = false;
        orphan.stock = 0;
        kept.push(await repo.save(orphan));
      } else {
        await repo.delete({ id: orphan.id });
      }
    }

    await this.syncTotal(manager, product.id);
    return kept.sort((a, b) => a.position - b.position);
  }

  /**
   * A product must always have at least one variant, or nothing can be bought.
   * An empty submission becomes the one-size row.
   */
  private normalizeOrDefault(
    input: VariantInput[] | undefined,
    existing: ProductVariant[],
  ): NormalizedVariant[] {
    const wanted = normalizeVariants(input);
    if (wanted.length > 0) return wanted;

    const carried = existing.find((v) => v.size === ONE_SIZE);
    return [
      {
        size: ONE_SIZE,
        sku: carried?.sku ?? null,
        stock: carried?.stock ?? 0,
        priceDeltaCents: 0,
        position: 0,
        isActive: true,
      },
    ];
  }

  /** Keeps the denormalised `products.stock` equal to the sum of its variants. */
  async syncTotal(manager: EntityManager, productId: string): Promise<number> {
    const rows = await manager.getRepository(ProductVariant).find({
      where: { productId },
    });
    const total = sumStock(rows);
    await manager
      .getRepository(Product)
      .update({ id: productId }, { stock: total });
    return total;
  }

  /**
   * Takes units off one variant, or fails.
   *
   * The guard is in the WHERE clause, so two checkouts racing for the last
   * unit cannot both succeed — the second matches no row. This is the single
   * most important query in the shop.
   */
  async decrement(
    manager: EntityManager,
    variantId: string,
    quantity: number,
    label: string,
  ): Promise<void> {
    const result = await manager.query<unknown[]>(
      `UPDATE "product_variants"
         SET "stock" = "stock" - $2, "updatedAt" = now()
       WHERE "id" = $1 AND "stock" >= $2 AND "isActive" = true
       RETURNING "id"`,
      [variantId, quantity],
    );
    if (!Array.isArray(result) || result.length === 0) {
      throw new BadRequestException(`Not enough stock for ${label}`);
    }
  }

  /** Puts units back — cancellations and returns. */
  async increment(
    manager: EntityManager,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    await manager.query(
      `UPDATE "product_variants"
         SET "stock" = "stock" + $2, "updatedAt" = now()
       WHERE "id" = $1`,
      [variantId, quantity],
    );
  }

  /** Resolves the variant a shopper asked for, by product and size label. */
  async findFor(
    manager: EntityManager,
    productId: string,
    size: string | null | undefined,
  ): Promise<ProductVariant | null> {
    return manager.getRepository(ProductVariant).findOne({
      where: { productId, size: size ?? ONE_SIZE },
    });
  }
}
