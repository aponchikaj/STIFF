import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Comment } from '../comments/comment.entity';
import { Paginated, paginate } from '../common/types/paginated';
import { OrderItem } from '../orders/order-item.entity';
import { Reaction, ReactionType } from '../reactions/reaction.entity';
import { User } from '../users/user.entity';
import {
  CreateProductDto,
  ListProductsQueryDto,
  UpdateProductDto,
} from './dto/products.dto';
import { Product } from './product.entity';
import { isLive } from './preorder';
import { ProductVariant } from './product-variant.entity';
import {
  NO_COLOUR,
  ONE_SIZE,
  type VariantInput,
  normalizeVariants,
} from './stock';
import { FitService, type FitReport } from './fit.service';
import { VariantsService } from './variants.service';

/**
 * Keeps `imageAlts` index-aligned with `images`.
 *
 * Longer than the photo list means the admin removed a picture and its
 * description is now describing someone else's — so the tail is dropped rather
 * than left to shift every alt by one.
 */
function trimAlts(alts: string[] | undefined, images: string[]): string[] {
  if (!alts) return [];
  return alts.slice(0, images.length).map((alt) => alt.trim().slice(0, 300));
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProductWithVariants = Product & {
  variants: ProductVariant[];
};

/** A shot from the archive that features this piece. */
export interface ArchiveShot {
  id: string;
  slug: string;
  title: string;
  altText: string | null;
  imageUrl: string;
  width: number | null;
  height: number | null;
  rotation: number;
}

export type ProductWithReaction = ProductWithVariants & {
  myReaction: ReactionType | null;
  /** How it fits, from the people who bought it. */
  fit: FitReport;
  /** "Seen in the archive" — ties the two halves of the site together. */
  archiveShots: ArchiveShot[];
};

/**
 * The sizes a product advertises, derived from whichever shape the caller sent.
 *
 * `products.sizes` is now just a denormalised label list for browsing; variants
 * are the truth. It is kept in step here so filters and cards need no join.
 */
function variantSizes(
  dto: { variants?: VariantInput[]; sizes?: string[] },
  fallback: string[] = [],
): string[] {
  if (dto.variants !== undefined) {
    // Deduplicated: with colourways the same size appears once per colour, and
    // the label list is about which sizes exist, not how many rows hold them.
    return [
      ...new Set(
        normalizeVariants(dto.variants)
          .map((v) => v.size)
          .filter((size) => size !== ONE_SIZE),
      ),
    ];
  }
  if (dto.sizes !== undefined) return dto.sizes;
  return fallback;
}

/**
 * Variant rows from either payload shape.
 *
 * A caller still sending `sizes` + a single `stock` total gets that total put
 * on the first size, matching what the old jsonb path did — so an admin build
 * that predates variants keeps working instead of silently zeroing stock.
 */
function variantsFrom(
  dto: { variants?: VariantInput[]; sizes?: string[]; stock?: number },
  fallbackSizes: string[] = [],
): VariantInput[] {
  if (dto.variants !== undefined) return dto.variants;

  const sizes = dto.sizes ?? fallbackSizes;
  if (sizes.length === 0) {
    return [{ size: ONE_SIZE, color: NO_COLOUR, stock: dto.stock ?? 0 }];
  }
  return sizes.map((size, i) => ({
    size,
    color: NO_COLOUR,
    stock: i === 0 ? (dto.stock ?? 0) : 0,
  }));
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Reaction)
    private readonly reactionRepo: Repository<Reaction>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    private readonly variantsService: VariantsService,
    private readonly fitService: FitService,
    private readonly dataSource: DataSource,
  ) {}

  async list(
    query: ListProductsQueryDto,
    user?: User,
  ): Promise<Paginated<ProductWithVariants>> {
    const qb = this.productRepo.createQueryBuilder('product');

    if (user?.role !== 'admin') {
      qb.andWhere('product.isActive = true');
      // A scheduled drop stays hidden until its moment, even with isActive on
      // — otherwise ticking the box early leaks it.
      qb.andWhere(
        '(product."publishAt" IS NULL OR product."publishAt" <= now())',
      );
    }
    if (query.search) {
      qb.andWhere(
        '(product.name ILIKE :search OR product.description ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.category) {
      qb.andWhere('product.category = :category', {
        category: query.category,
      });
    }
    if (query.minPrice !== undefined) {
      qb.andWhere('product.priceCents >= :minPrice', {
        minPrice: query.minPrice,
      });
    }
    if (query.maxPrice !== undefined) {
      qb.andWhere('product.priceCents <= :maxPrice', {
        maxPrice: query.maxPrice,
      });
    }

    switch (query.sort) {
      case 'price_asc':
        qb.orderBy('product.priceCents', 'ASC');
        break;
      case 'price_desc':
        qb.orderBy('product.priceCents', 'DESC');
        break;
      case 'popular':
        qb.orderBy('product.likeCount', 'DESC').addOrderBy(
          'product.createdAt',
          'DESC',
        );
        break;
      default:
        qb.orderBy('product.createdAt', 'DESC');
    }

    qb.skip(query.skip).take(query.pageSize);
    const [items, total] = await qb.getManyAndCount();

    // One extra query for the page rather than a join that would multiply
    // every product row by its variant count.
    const byProduct = await this.variantsService.listForMany(
      items.map((p) => p.id),
    );
    const withVariants = items.map((product) => ({
      ...product,
      variants: byProduct.get(product.id) ?? [],
    }));

    return paginate(withVariants, total, query.page, query.pageSize);
  }

  async getByIdOrSlug(
    idOrSlug: string,
    user?: User,
  ): Promise<ProductWithReaction> {
    const product = await this.productRepo.findOne({
      where: UUID_RE.test(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug },
    });
    const visible = isLive(product ?? { isActive: false });
    if (!product || (!visible && user?.role !== 'admin')) {
      throw new NotFoundException('Product not found');
    }

    let myReaction: ReactionType | null = null;
    if (user) {
      const reaction = await this.reactionRepo.findOne({
        where: { userId: user.id, targetType: 'product', targetId: product.id },
      });
      myReaction = reaction?.type ?? null;
    }
    // Three independent reads, so they go together rather than in sequence.
    const [variants, fit, archiveShots] = await Promise.all([
      this.variantsService.listFor(product.id),
      this.fitService.reportFor(product, user?.id),
      this.fitService.archiveShotsFor(product.id) as Promise<ArchiveShot[]>,
    ]);
    return { ...product, variants, myReaction, fit, archiveShots };
  }

  async findById(id: string): Promise<Product | null> {
    return this.productRepo.findOne({ where: { id } });
  }

  async create(dto: CreateProductDto): Promise<ProductWithVariants> {
    const slug = await this.uniqueSlug(dto.name);
    return this.dataSource.transaction(async (manager) => {
      const product = await manager.save(
        manager.create(Product, {
          name: dto.name,
          slug,
          description: dto.description ?? '',
          priceCents: dto.priceCents,
          images: dto.images ?? [],
          imageAlts: trimAlts(dto.imageAlts, dto.images ?? []),
          category: dto.category ?? null,
          sizes: variantSizes(dto),
          stock: 0,
        }),
      );
      const variants = await this.variantsService.replaceFor(
        manager,
        product,
        variantsFrom(dto),
      );
      product.stock = await this.variantsService.syncTotal(manager, product.id);
      return { ...product, variants };
    });
  }

  async update(
    id: string,
    dto: UpdateProductDto,
  ): Promise<ProductWithVariants> {
    const existing = await this.productRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Product not found');

    const slug =
      dto.name !== undefined && dto.name !== existing.name
        ? await this.uniqueSlug(dto.name, id)
        : existing.slug;

    return this.dataSource.transaction(async (manager) => {
      const product = await manager.findOneOrFail(Product, { where: { id } });

      if (dto.name !== undefined) {
        product.name = dto.name;
        product.slug = slug;
      }
      if (dto.description !== undefined) product.description = dto.description;
      if (dto.priceCents !== undefined) product.priceCents = dto.priceCents;
      if (dto.images !== undefined) product.images = dto.images;
      if (dto.imageAlts !== undefined) {
        product.imageAlts = trimAlts(dto.imageAlts, product.images);
      }
      if (dto.category !== undefined) product.category = dto.category;
      if (dto.isActive !== undefined) product.isActive = dto.isActive;
      if (dto.publishAt !== undefined) {
        product.publishAt = dto.publishAt ? new Date(dto.publishAt) : null;
      }
      if (dto.preorderEnabled !== undefined) {
        product.preorderEnabled = dto.preorderEnabled;
      }
      if (dto.preorderShipsAt !== undefined) {
        product.preorderShipsAt = dto.preorderShipsAt || null;
      }
      if (dto.preorderLimit !== undefined) {
        product.preorderLimit = Math.max(0, dto.preorderLimit);
      }

      const touchesStock =
        dto.variants !== undefined || dto.sizes !== undefined;
      if (touchesStock) product.sizes = variantSizes(dto, product.sizes);

      await manager.save(product);

      const variants = touchesStock
        ? await this.variantsService.replaceFor(
            manager,
            product,
            variantsFrom(dto, product.sizes),
          )
        : await manager.getRepository(ProductVariant).find({
            where: { productId: id },
            order: { position: 'ASC' },
          });

      product.stock = await this.variantsService.syncTotal(manager, id);
      return { ...product, variants };
    });
  }

  /** Soft-deactivate if the product was ever ordered, otherwise hard delete. */
  async remove(id: string): Promise<{ success: true; soft: boolean }> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    const ordered = await this.orderItemRepo.exists({
      where: { productId: id },
    });
    if (ordered) {
      product.isActive = false;
      await this.productRepo.save(product);
      return { success: true, soft: true };
    }

    await this.commentRepo.delete({ targetType: 'product', targetId: id });
    await this.reactionRepo.delete({ targetType: 'product', targetId: id });
    await this.productRepo.delete({ id });
    return { success: true, soft: false };
  }

  /**
   * Opens drops whose moment has arrived.
   *
   * Products are hidden by the query above until `publishAt` passes, so this
   * only clears the timestamp — it is bookkeeping, not the gate. That means a
   * missed cron run delays nothing.
   */
  async openScheduledDrops(): Promise<number> {
    const result = await this.productRepo
      .createQueryBuilder()
      .update(Product)
      .set({ publishAt: null })
      .where('"publishAt" IS NOT NULL AND "publishAt" <= now()')
      .execute();
    return result.affected ?? 0;
  }

  private async uniqueSlug(name: string, excludeId?: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'product';

    let slug = base;
    for (let attempt = 0; attempt < 5; attempt++) {
      const qb = this.productRepo
        .createQueryBuilder('product')
        .where('product.slug = :slug', { slug });
      if (excludeId) qb.andWhere('product.id != :excludeId', { excludeId });
      const clash = await qb.getOne();
      if (!clash) return slug;
      slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    }
    throw new ConflictException('Could not generate a unique slug');
  }
}
