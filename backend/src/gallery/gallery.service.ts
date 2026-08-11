import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from '../comments/comment.entity';
import { Paginated, paginate } from '../common/types/paginated';
import { Reaction, ReactionType } from '../reactions/reaction.entity';
import { User } from '../users/user.entity';
import {
  CreateGalleryItemDto,
  ListGalleryQueryDto,
  UpdateGalleryItemDto,
} from './dto/gallery.dto';
import { GalleryItem } from './gallery-item.entity';

/** Just enough to render a prev/next thumbnail and prefetch its route. */
export type GalleryNeighbour = Pick<
  GalleryItem,
  'id' | 'title' | 'imageUrl' | 'width' | 'height'
>;

export type GalleryItemWithReaction = GalleryItem & {
  myReaction: ReactionType | null;
  /** 1-based position in the public archive ordering. */
  position: number;
  total: number;
  prev: GalleryNeighbour | null;
  next: GalleryNeighbour | null;
};

const NEIGHBOUR_FIELDS = [
  'item.id',
  'item.title',
  'item.imageUrl',
  'item.width',
  'item.height',
] as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class GalleryService {
  constructor(
    @InjectRepository(GalleryItem)
    private readonly galleryRepo: Repository<GalleryItem>,
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Reaction)
    private readonly reactionRepo: Repository<Reaction>,
  ) {}

  async list(
    query: ListGalleryQueryDto,
    user?: User,
  ): Promise<Paginated<GalleryItem>> {
    const qb = this.galleryRepo.createQueryBuilder('item');
    if (!(user?.role === 'admin' && query.includeArchived)) {
      qb.andWhere('item.isArchived = false');
    }
    switch (query.sort) {
      case 'newest':
        qb.orderBy('item.createdAt', 'DESC');
        break;
      case 'popular':
        qb.orderBy('item.likeCount', 'DESC').addOrderBy(
          'item.createdAt',
          'DESC',
        );
        break;
      default:
        qb.orderBy('item.sortOrder', 'ASC').addOrderBy(
          'item.createdAt',
          'DESC',
        );
    }
    qb.skip(query.skip).take(query.pageSize);
    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, query.page, query.pageSize);
  }

  /**
   * Public lookup by slug. The slug is the item's title (`/gallery/0001`), but
   * a raw UUID is still accepted so links shared before the switch keep
   * resolving.
   */
  async getBySlug(slug: string, user?: User): Promise<GalleryItemWithReaction> {
    const item = UUID_PATTERN.test(slug)
      ? await this.galleryRepo.findOne({ where: { id: slug } })
      : await this.galleryRepo.findOne({ where: { title: slug } });

    if (!item || (item.isArchived && user?.role !== 'admin')) {
      throw new NotFoundException('Gallery item not found');
    }
    return this.decorate(item, user);
  }

  private async decorate(
    item: GalleryItem,
    user?: User,
  ): Promise<GalleryItemWithReaction> {
    const id = item.id;

    let myReaction: ReactionType | null = null;
    if (user) {
      const reaction = await this.reactionRepo.findOne({
        where: { userId: user.id, targetType: 'gallery', targetId: id },
      });
      myReaction = reaction?.type ?? null;
    }

    const [position, total, prev, next] = await Promise.all([
      this.positionOf(item),
      this.galleryRepo.count({ where: { isArchived: false } }),
      this.neighbour(item, 'prev'),
      this.neighbour(item, 'next'),
    ]);

    return { ...item, myReaction, position, total, prev, next };
  }

  /**
   * Archive ordering is `sortOrder ASC, createdAt DESC` (see `list`), so
   * "before" means a lower sortOrder, or the same sortOrder and a later
   * createdAt.
   *
   * The anchor values are read back out of the table in SQL rather than passed
   * in from the loaded entity: `createdAt` is a microsecond-precision timestamp
   * and a JS Date only carries milliseconds, so a round-tripped value compares
   * as strictly earlier than the row it came from — which made every item its
   * own predecessor. Excluding the anchor id keeps it correct even when two
   * rows share a sortOrder (admin-added items all default to 0).
   */
  private orderPredicate(direction: 'prev' | 'next'): string {
    const anchorSort =
      '(SELECT a."sortOrder" FROM gallery_items a WHERE a.id = :anchorId)';
    const anchorDate =
      '(SELECT a."createdAt" FROM gallery_items a WHERE a.id = :anchorId)';
    return direction === 'prev'
      ? `(item.sortOrder < ${anchorSort} OR (item.sortOrder = ${anchorSort} AND item.createdAt > ${anchorDate}))`
      : `(item.sortOrder > ${anchorSort} OR (item.sortOrder = ${anchorSort} AND item.createdAt < ${anchorDate}))`;
  }

  private positionOf(item: GalleryItem): Promise<number> {
    return this.galleryRepo
      .createQueryBuilder('item')
      .where('item.isArchived = false')
      .andWhere('item.id != :anchorId')
      .andWhere(this.orderPredicate('prev'), { anchorId: item.id })
      .getCount()
      .then((before) => before + 1);
  }

  private neighbour(
    item: GalleryItem,
    direction: 'prev' | 'next',
  ): Promise<GalleryNeighbour | null> {
    return this.galleryRepo
      .createQueryBuilder('item')
      .select([...NEIGHBOUR_FIELDS])
      .where('item.isArchived = false')
      .andWhere('item.id != :anchorId')
      .andWhere(this.orderPredicate(direction), { anchorId: item.id })
      .orderBy('item.sortOrder', direction === 'prev' ? 'DESC' : 'ASC')
      .addOrderBy('item.createdAt', direction === 'prev' ? 'ASC' : 'DESC')
      .limit(1)
      .getOne();
  }

  /**
   * The title is the public slug, so it has to be unique. The column carries a
   * unique index as the real guarantee; this check exists to turn the raw
   * driver error into a message the admin panel can show.
   */
  private async assertTitleFree(title: string, exceptId?: string) {
    const clash = await this.galleryRepo.findOne({ where: { title } });
    if (clash && clash.id !== exceptId) {
      throw new ConflictException(
        `"${title}" is already used by another shot — titles must be unique.`,
      );
    }
  }

  async create(dto: CreateGalleryItemDto): Promise<GalleryItem> {
    await this.assertTitleFree(dto.title);
    const item = this.galleryRepo.create({
      title: dto.title,
      description: dto.description ?? null,
      imageUrl: dto.imageUrl,
      width: dto.width ?? null,
      height: dto.height ?? null,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.galleryRepo.save(item);
  }

  async update(id: string, dto: UpdateGalleryItemDto): Promise<GalleryItem> {
    const item = await this.galleryRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Gallery item not found');

    if (dto.title !== undefined && dto.title !== item.title) {
      await this.assertTitleFree(dto.title, id);
    }
    if (dto.title !== undefined) item.title = dto.title;
    if (dto.description !== undefined) item.description = dto.description;
    if (dto.imageUrl !== undefined) item.imageUrl = dto.imageUrl;
    if (dto.width !== undefined) item.width = dto.width;
    if (dto.height !== undefined) item.height = dto.height;
    if (dto.sortOrder !== undefined) item.sortOrder = dto.sortOrder;
    if (dto.isArchived !== undefined) item.isArchived = dto.isArchived;

    return this.galleryRepo.save(item);
  }

  async remove(id: string): Promise<void> {
    const item = await this.galleryRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Gallery item not found');
    await this.commentRepo.delete({ targetType: 'gallery', targetId: id });
    await this.reactionRepo.delete({ targetType: 'gallery', targetId: id });
    await this.galleryRepo.delete({ id });
  }
}
