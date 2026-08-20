import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { ProductVariant } from '../products/product-variant.entity';
import { isLive } from '../products/preorder';
import { WishlistItem } from './wishlist-item.entity';

/** A saved product, with the variants the card needs to price it. */
export type SavedProduct = Product & { variants: ProductVariant[] };

@Injectable()
export class WishlistService {
  constructor(
    @InjectRepository(WishlistItem)
    private readonly wishlistRepo: Repository<WishlistItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
  ) {}

  /** The ids only — what the storefront needs to fill in every heart at once. */
  async idsFor(userId: string): Promise<string[]> {
    const rows = await this.wishlistRepo.find({
      where: { userId },
      select: { productId: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => row.productId);
  }

  async list(userId: string): Promise<SavedProduct[]> {
    const rows = await this.wishlistRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    if (rows.length === 0) return [];

    const products = await this.productRepo.find({
      where: { id: In(rows.map((row) => row.productId)) },
    });
    const variants = await this.variantRepo.find({
      where: { productId: In(products.map((p) => p.id)) },
      order: { position: 'ASC' },
    });
    const byProduct = new Map<string, ProductVariant[]>();
    for (const variant of variants) {
      byProduct.set(variant.productId, [
        ...(byProduct.get(variant.productId) ?? []),
        variant,
      ]);
    }

    // Keeps the saved order, and drops anything that has since been pulled
    // from sale rather than linking somewhere that 404s.
    const byId = new Map(products.map((p) => [p.id, p]));
    return rows
      .map((row) => byId.get(row.productId))
      .filter((product): product is Product => !!product && isLive(product))
      .map((product) => ({
        ...product,
        variants: byProduct.get(product.id) ?? [],
      }));
  }

  /** Saves, or unsaves if it was already there. Returns the new state. */
  async toggle(userId: string, productId: string): Promise<{ saved: boolean }> {
    const product = await this.productRepo.findOne({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const existing = await this.wishlistRepo.findOne({
      where: { userId, productId },
    });
    if (existing) {
      await this.wishlistRepo.delete({ id: existing.id });
      return { saved: false };
    }
    await this.wishlistRepo.save(
      this.wishlistRepo.create({ userId, productId }),
    );
    return { saved: true };
  }

  async remove(userId: string, productId: string): Promise<void> {
    await this.wishlistRepo.delete({ userId, productId });
  }

  /**
   * Folds a signed-out list into the account being signed into.
   *
   * The same bargain the guest cart makes: saving something should not require
   * an account, and making one later should not lose what was saved. Unknown
   * or withdrawn ids are skipped rather than failing the merge — the list may
   * have sat in a browser for months.
   */
  async merge(userId: string, productIds: string[]): Promise<string[]> {
    const wanted = [...new Set(productIds)].slice(0, 200);
    if (wanted.length > 0) {
      const live = await this.productRepo.find({
        where: { id: In(wanted) },
        select: { id: true },
      });
      if (live.length > 0) {
        await this.wishlistRepo
          .createQueryBuilder()
          .insert()
          .into(WishlistItem)
          .values(live.map((product) => ({ userId, productId: product.id })))
          .orIgnore()
          .execute();
      }
    }
    return this.idsFor(userId);
  }
}
