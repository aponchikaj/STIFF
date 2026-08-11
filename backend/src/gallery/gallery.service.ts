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
  BulkGalleryItemDto,
  CreateGalleryItemDto,
  ListGalleryQueryDto,
  UpdateGalleryItemDto,
} from './dto/gallery.dto';
import { GalleryItem } from './gallery-item.entity';

/** Just enough to render a prev/next thumbnail and prefetch its route. */
export type GalleryNeighbour = Pick<
  GalleryItem,
  'id' | 'slug' | 'title' | 'altText' | 'imageUrl' | 'width' | 'height'
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
  'item.slug',
  'item.title',
  'item.altText',
  'item.imageUrl',
  'item.width',
  'item.height',
] as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * URL-safe form of a title. Archive titles are numbers ("0057") and survive
 * this untouched; anything typed by hand becomes lowercase and hyphenated so
 * it can't produce a link that needs escaping.
 */
function slugify(input: string): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  // Non-Latin titles (Georgian, say) strip to nothing — fall back to a
  // timestamp rather than saving an empty slug the router can't address.
  return slug || `shot-${Date.now()}`;
}

/** Archive numbering is zero-padded to four digits. */
function pad(n: number): string {
  return String(n).padStart(4, '0');
}

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
   * Public lookup by route param.
   *
   * Order of resolution:
   * - UUID: `/gallery/{uuid}`
   * - Slug: `/gallery/{slug}`
   * - Legacy fallback: older shared links used `title` as the slug. After
   *   migration we keep `slug` stable, but we still fall back to `title` for
   *   safety.
   */
  async getBySlug(slug: string, user?: User): Promise<GalleryItemWithReaction> {
    const item = UUID_PATTERN.test(slug)
      ? await this.galleryRepo.findOne({ where: { id: slug } })
      : ((await this.galleryRepo.findOne({ where: { slug } })) ??
        (await this.galleryRepo.findOne({ where: { title: slug } })));

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
   * Ensure the stable URL slug stays unique.
   *
   * The DB constraint is the final guarantee, but we translate clashes into a
   * readable message for the admin panel.
   */
  private async assertSlugFree(slug: string, exceptId?: string) {
    const clash = await this.galleryRepo.findOne({ where: { slug } });
    if (clash && clash.id !== exceptId) {
      throw new ConflictException(
        `"${slug}" is already used by another shot — slugs must be unique.`,
      );
    }
  }

  async create(dto: CreateGalleryItemDto): Promise<GalleryItem> {
    const slug = slugify(dto.slug ?? dto.title);
    await this.assertSlugFree(slug);
    const item = this.galleryRepo.create({
      slug,
      title: dto.title,
      description: dto.description ?? null,
      altText: dto.altText ?? null,
      imageUrl: dto.imageUrl,
      width: dto.width ?? null,
      height: dto.height ?? null,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.galleryRepo.save(item);
  }

  /**
   * Add a batch of shots in one request.
   *
   * Titles are optional per item: a shoot is usually dropped in as a folder of
   * files, and numbering them by hand is the slowest part of the job. Anything
   * without a title continues the archive's numbering (0058, 0059, …), and the
   * batch keeps the order the files arrived in.
   */
  async createMany(dtos: BulkGalleryItemDto[]): Promise<GalleryItem[]> {
    let nextNumber = await this.nextArchiveNumber();
    const maxSort = await this.maxSortOrder();

    const rows: GalleryItem[] = [];
    const taken = new Set<string>();

    for (const [index, dto] of dtos.entries()) {
      const title = dto.title?.trim() || pad(nextNumber++);
      const slug = slugify(dto.slug ?? title);

      // Two files in the same batch can resolve to the same slug, and the
      // unique index would only fail on the second insert — check the batch
      // as well as the table.
      if (taken.has(slug)) {
        throw new ConflictException(
          `"${slug}" appears twice in this upload — slugs must be unique.`,
        );
      }
      taken.add(slug);
      await this.assertSlugFree(slug);

      rows.push(
        this.galleryRepo.create({
          slug,
          title,
          description: dto.description ?? null,
          altText: dto.altText ?? null,
          imageUrl: dto.imageUrl,
          width: dto.width ?? null,
          height: dto.height ?? null,
          sortOrder: dto.sortOrder ?? maxSort + 1 + index,
        }),
      );
    }

    return this.galleryRepo.save(rows);
  }

  /**
   * Highest number already used as a title, so a bulk upload can carry on from
   * it. Titles that aren't plain numbers are ignored.
   */
  private async nextArchiveNumber(): Promise<number> {
    const row = await this.galleryRepo
      .createQueryBuilder('item')
      .select(
        `MAX(NULLIF(regexp_replace(item.title, '\\D', '', 'g'), '')::int)`,
        'max',
      )
      .where(`item.title ~ '^[0-9]+$'`)
      .getRawOne<{ max: string | null }>();
    return (row?.max ? parseInt(row.max, 10) : 0) + 1;
  }

  private async maxSortOrder(): Promise<number> {
    const row = await this.galleryRepo
      .createQueryBuilder('item')
      .select('MAX(item.sortOrder)', 'max')
      .getRawOne<{ max: number | null }>();
    return row?.max ?? 0;
  }

  /**
   * Persist a new archive order in one transaction, so a failure halfway
   * through can't leave the gallery in a half-sorted state.
   */
  async reorder(entries: { id: string; sortOrder: number }[]): Promise<void> {
    await this.galleryRepo.manager.transaction(async (manager) => {
      for (const entry of entries) {
        await manager.update(
          GalleryItem,
          { id: entry.id },
          {
            sortOrder: entry.sortOrder,
          },
        );
      }
    });
  }

  async update(id: string, dto: UpdateGalleryItemDto): Promise<GalleryItem> {
    const item = await this.galleryRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Gallery item not found');

    const slug = dto.slug === undefined ? undefined : slugify(dto.slug);
    if (slug !== undefined && slug !== item.slug) {
      await this.assertSlugFree(slug, id);
    }
    if (slug !== undefined) item.slug = slug;
    if (dto.title !== undefined) item.title = dto.title;
    if (dto.description !== undefined) item.description = dto.description;
    if (dto.altText !== undefined) item.altText = dto.altText;
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
