import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { ProductVariant } from '../products/product-variant.entity';
import { availability } from '../products/availability';
import { NO_COLOUR, ONE_SIZE, priceForSize } from '../products/stock';
import { CartItem } from './cart-item.entity';
import { CartOwner, ownerWhere } from './cart-owner';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';

export interface CartView {
  items: CartItem[];
  subtotalCents: number;
}

/**
 * Product price plus this line's per-size delta.
 *
 * Exported so it can be tested directly: the cart quoting a different number
 * to the one checkout charges is a silent, money-losing bug, and it happened
 * once already when this was inlined.
 */
export function unitPriceFor(item: CartItem): number {
  return priceForSize(
    {
      priceCents: item.product.priceCents,
      variants: item.variant ? [item.variant] : [],
    },
    item.size,
    // The line's own colour, not the default: looking up by size alone would
    // miss a colourway variant entirely and quietly drop its price delta.
    item.variant?.color ?? NO_COLOUR,
  );
}

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem)
    private readonly cartRepo: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
    private readonly dataSource: DataSource,
  ) {}

  async getCart(owner: CartOwner): Promise<CartView> {
    const items = await this.cartRepo.find({
      where: ownerWhere(owner),
      relations: { product: true, variant: true },
      order: { createdAt: 'ASC' },
    });
    // Must match what checkout charges. `priceForSize` is the one definition
    // of a unit price; computing it here and again in orders is how a cart
    // ends up quoting a different number to the one taken.
    const subtotalCents = items.reduce(
      (sum, item) => sum + unitPriceFor(item) * item.quantity,
      0,
    );
    return { items, subtotalCents };
  }

  async addItem(owner: CartOwner, dto: AddCartItemDto): Promise<CartView> {
    const product = await this.productRepo.findOne({
      where: { id: dto.productId },
    });
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }

    // `variantId` wins when the client knows it — the storefront always does.
    // Falling back to (size, colour) keeps older clients, and `buy now` links,
    // working.
    const variant = dto.variantId
      ? await this.variantRepo.findOne({
          where: { id: dto.variantId, productId: dto.productId },
        })
      : await this.variantRepo.findOne({
          where: {
            productId: dto.productId,
            size: dto.size ?? ONE_SIZE,
            color: dto.color ?? NO_COLOUR,
          },
        });
    if (!variant || !variant.isActive) {
      throw new BadRequestException('That option is not available');
    }
    const size = variant.size;

    const offer = availability(variant);
    if (offer.kind === 'unavailable') {
      throw new BadRequestException(offer.reason);
    }

    const where = ownerWhere(owner);
    // Keyed on the variant, not (product, size): two colourways of the same
    // size are two lines, which is what `UQ_cart_items_*_variant` enforces.
    const existing = await this.cartRepo.findOne({
      where: { ...where, variantId: variant.id },
    });
    const newQuantity = (existing?.quantity ?? 0) + dto.quantity;
    if (offer.max < newQuantity) {
      throw new BadRequestException(`Only ${offer.max} left in stock`);
    }

    if (existing) {
      existing.quantity = newQuantity;
      // Backfills the link on a row written before variants existed.
      existing.variantId = variant.id;
      await this.cartRepo.save(existing);
    } else {
      await this.cartRepo.save(
        this.cartRepo.create({
          ...where,
          productId: dto.productId,
          variantId: variant.id,
          quantity: dto.quantity,
          size,
        }),
      );
    }
    return this.getCart(owner);
  }

  async updateItem(
    owner: CartOwner,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartView> {
    const item = await this.cartRepo.findOne({
      where: { id: itemId, ...ownerWhere(owner) },
      relations: { product: true, variant: true },
    });
    if (!item) throw new NotFoundException('Cart item not found');
    const offer = item.variant
      ? availability(item.variant)
      : ({ kind: 'unavailable', reason: 'That size is gone.' } as const);
    if (offer.kind === 'unavailable') {
      throw new BadRequestException(offer.reason);
    }
    if (offer.max < dto.quantity) {
      throw new BadRequestException(`Only ${offer.max} available`);
    }
    item.quantity = dto.quantity;
    await this.cartRepo.save(item);
    return this.getCart(owner);
  }

  async removeItem(owner: CartOwner, itemId: string): Promise<CartView> {
    const result = await this.cartRepo.delete({
      id: itemId,
      ...ownerWhere(owner),
    });
    if (!result.affected) throw new NotFoundException('Cart item not found');
    return this.getCart(owner);
  }

  async clear(owner: CartOwner): Promise<void> {
    await this.cartRepo.delete(ownerWhere(owner));
  }

  /**
   * Folds an anonymous cart into the account being signed into.
   *
   * Called on login and on register, so the thing someone added before making
   * an account is still there afterwards. Quantities add up rather than
   * overwrite, and are capped at what is actually in stock so the merge cannot
   * produce a cart that fails at checkout.
   *
   * Runs in one transaction: a partial merge would silently lose rows.
   */
  async mergeGuestCart(guestId: string, userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CartItem);
      const guestItems = await repo.find({
        where: { guestId },
        relations: { product: true, variant: true },
      });
      if (guestItems.length === 0) return;

      for (const item of guestItems) {
        // A pre-variants row carries no variantId; matching on null would
        // fold it into an unrelated line, so it merges as its own row.
        const existing = item.variantId
          ? await repo.findOne({ where: { userId, variantId: item.variantId } })
          : null;
        const offer = item.variant ? availability(item.variant) : null;
        const available = offer && offer.kind !== 'unavailable' ? offer.max : 0;

        if (existing) {
          existing.quantity = Math.min(
            existing.quantity + item.quantity,
            Math.max(available, existing.quantity),
          );
          await repo.save(existing);
          await repo.delete({ id: item.id });
        } else {
          // Re-own the row rather than copy it, so createdAt (and the cart's
          // order) survives the merge.
          item.userId = userId;
          item.guestId = null;
          item.quantity = Math.min(item.quantity, Math.max(available, 0));
          if (item.quantity > 0) {
            await repo.save(item);
          } else {
            await repo.delete({ id: item.id });
          }
        }
      }
    });
  }

  /** Housekeeping: anonymous carts nobody came back to. */
  async purgeStaleGuestCarts(olderThanDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await this.cartRepo
      .createQueryBuilder()
      .delete()
      .where('"guestId" IS NOT NULL')
      .andWhere('"userId" IS NULL')
      .andWhere('"updatedAt" < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }
}
