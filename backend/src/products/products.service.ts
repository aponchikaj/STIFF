import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProductWithReaction = Product & {
  myReaction: ReactionType | null;
};

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
  ) {}

  async list(
    query: ListProductsQueryDto,
    user?: User,
  ): Promise<Paginated<Product>> {
    const qb = this.productRepo.createQueryBuilder('product');

    if (user?.role !== 'admin') {
      qb.andWhere('product.isActive = true');
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
    return paginate(items, total, query.page, query.pageSize);
  }

  async getByIdOrSlug(
    idOrSlug: string,
    user?: User,
  ): Promise<ProductWithReaction> {
    const product = await this.productRepo.findOne({
      where: UUID_RE.test(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug },
    });
    if (!product || (!product.isActive && user?.role !== 'admin')) {
      throw new NotFoundException('Product not found');
    }

    let myReaction: ReactionType | null = null;
    if (user) {
      const reaction = await this.reactionRepo.findOne({
        where: { userId: user.id, targetType: 'product', targetId: product.id },
      });
      myReaction = reaction?.type ?? null;
    }
    return { ...product, myReaction };
  }

  async findById(id: string): Promise<Product | null> {
    return this.productRepo.findOne({ where: { id } });
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const slug = await this.uniqueSlug(dto.name);
    const product = this.productRepo.create({
      name: dto.name,
      slug,
      description: dto.description ?? '',
      priceCents: dto.priceCents,
      images: dto.images ?? [],
      category: dto.category ?? null,
      sizes: dto.sizes ?? [],
      stock: dto.stock ?? 0,
    });
    return this.productRepo.save(product);
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');

    if (dto.name !== undefined && dto.name !== product.name) {
      product.name = dto.name;
      product.slug = await this.uniqueSlug(dto.name, id);
    }
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.priceCents !== undefined) product.priceCents = dto.priceCents;
    if (dto.images !== undefined) product.images = dto.images;
    if (dto.category !== undefined) product.category = dto.category;
    if (dto.sizes !== undefined) product.sizes = dto.sizes;
    if (dto.stock !== undefined) product.stock = dto.stock;
    if (dto.isActive !== undefined) product.isActive = dto.isActive;

    return this.productRepo.save(product);
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
