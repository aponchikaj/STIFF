import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from '../comments/comment.entity';
import { Paginated, paginate } from '../common/types/paginated';
import { padNumber, slugify } from '../common/utils/slug';
import { FitService, ProductInShot } from '../products/fit.service';
import { Reaction, ReactionType } from '../reactions/reaction.entity';
import { User } from '../users/user.entity';
import {
  afterCursor,
  decodeCursor,
  encodeCursor,
  GallerySort,
  orderingFor,
} from './cursor';
import { GalleryCredit } from './gallery-credit.entity';
import { GalleryShoot } from './gallery-shoot.entity';
import { GalleryTag } from './gallery-tag.entity';
import { PlaceholderService } from './placeholder.service';
import { ShootsService } from './shoots.service';
import { TagsService } from './tags.service';
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
  | 'id'
  | 'slug'
  | 'title'
  | 'altText'
  | 'imageUrl'
  | 'width'
  | 'height'
  | 'rotation'
>;

/** A shot as the grid renders it: enough to filter by and label with. */
export type GalleryItemWithTags = GalleryItem & { tags: GalleryTag[] };

/**
 * A page of the archive.
 *
 * `total` still answers "how far through am I"; `nextCursor` is how the next
 * page is actually asked for. Null means this was the last one.
 */
export interface PaginatedShots extends Paginated<GalleryItemWithTags> {
  nextCursor: string | null;
}

export type GalleryItemWithReaction = GalleryItem & {
  myReaction: ReactionType | null;
  /** The pieces worn in this shot, with their pins. "Shop the look". */
  products: ProductInShot[];
  tags: GalleryTag[];
  /** This frame's credits, falling back to its shoot's. */
  credits: GalleryCredit[];
  /** The shoot it came out of, or null for the archive that predates shoots. */
  shoot: GalleryShoot | null;
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
  'item.rotation',
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
    @InjectRepository(GalleryShoot)
    private readonly shootRepo: Repository<GalleryShoot>,
    private readonly fitService: FitService,
    private readonly shootsService: ShootsService,
    private readonly tagsService: TagsService,
    private readonly placeholders: PlaceholderService,
  ) {}

  async list(query: ListGalleryQueryDto, user?: User): Promise<PaginatedShots> {
    const sort: GallerySort = query.sort ?? 'order';
    const qb = this.galleryRepo.createQueryBuilder('item');

    if (!(user?.role === 'admin' && query.includeArchived)) {
      qb.andWhere('item.isArchived = false');
    }

    if (query.shoot) {
      qb.andWhere(
        `item."shootId" IN (SELECT "id" FROM "gallery_shoots" WHERE "slug" = :shootSlug${
          user?.role === 'admin' ? '' : ' AND "isPublished" = true'
        })`,
        { shootSlug: query.shoot },
      );
    }

    // Several tags narrow rather than widen: "summer" and "tbilisi" means
    // both, which is the only reading that makes a second filter useful.
    // One EXISTS per tag, because a join would multiply the rows instead.
    (query.tag ?? []).forEach((slug, index) => {
      qb.andWhere(
        `EXISTS (
           SELECT 1 FROM "gallery_item_tags" link
           JOIN "gallery_tags" tag ON tag."id" = link."tagId"
           WHERE link."galleryItemId" = item."id" AND tag."slug" = :tagSlug${index}
         )`,
        { [`tagSlug${index}`]: slug },
      );
    });

    // Split before the cursor clause is added. `total` means "how big is this
    // archive", and counting through the cursor would answer "how much of it
    // is left" instead: the number would shrink with every page, and a grid
    // that says "31 of 25" is worse than one that says nothing.
    const countQb = qb.clone();

    const ordering = orderingFor(sort);
    ordering.forEach(([column, direction], index) => {
      if (index === 0) qb.orderBy(column, direction);
      else qb.addOrderBy(column, direction);
    });

    // A cursor supersedes `page`. Anything unreadable falls through to offset
    // paging from page 1, which is what a stale bookmark should do.
    const cursor = decodeCursor(query.cursor, sort);
    if (cursor) {
      const { clause, params } = afterCursor(cursor);
      qb.andWhere(clause, params);
    } else {
      qb.skip(query.skip);
    }
    qb.take(query.pageSize);

    const [items, total] = await Promise.all([
      qb.getMany(),
      countQb.getCount(),
    ]);
    const withTags = await this.attachTags(items);

    return {
      ...paginate(withTags, total, query.page, query.pageSize),
      nextCursor:
        items.length < query.pageSize
          ? null
          : await this.mintCursor(items[items.length - 1], sort),
    };
  }

  /**
   * A cursor for the row just handed out.
   *
   * The timestamp is re-read as text rather than taken off the loaded entity:
   * `createdAt` is microsecond-precision in Postgres and millisecond-precision
   * in JavaScript, so the round-tripped value compares as strictly earlier
   * than the row it came from and hands the same shot out again on the next
   * page. Same trap as `orderPredicate` below, same fix.
   */
  private async mintCursor(
    last: GalleryItem,
    sort: GallerySort,
  ): Promise<string | null> {
    const row = await this.galleryRepo
      .createQueryBuilder('item')
      .select(
        `to_char(item."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.US')`,
        'createdAt',
      )
      .where('item."id" = :id', { id: last.id })
      .getRawOne<{ createdAt: string }>();
    if (!row) return null;

    return encodeCursor({
      sort,
      sortOrder: last.sortOrder,
      likeCount: last.likeCount,
      createdAt: row.createdAt,
      id: last.id,
    });
  }

  /** One query for the whole page rather than one per shot. */
  private async attachTags(
    items: GalleryItem[],
  ): Promise<GalleryItemWithTags[]> {
    const byItem = await this.tagsService.tagsForMany(
      items.map((item) => item.id),
    );
    return items.map((item) => ({ ...item, tags: byItem.get(item.id) ?? [] }));
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

    const [position, total, prev, next, products, tags, credits, shoot] =
      await Promise.all([
        this.positionOf(item),
        this.galleryRepo.count({ where: { isArchived: false } }),
        this.neighbour(item, 'prev'),
        this.neighbour(item, 'next'),
        this.fitService.productsFor(id),
        this.tagsService.tagsFor(id),
        this.shootsService.creditsForItem(id, item.shootId),
        item.shootId
          ? this.shootRepo.findOne({ where: { id: item.shootId } })
          : Promise.resolve(null),
      ]);

    return {
      ...item,
      myReaction,
      position,
      total,
      prev,
      next,
      products,
      tags,
      credits,
      shoot,
    };
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
      rotation: dto.rotation ?? 0,
      sortOrder: dto.sortOrder ?? 0,
      shootId: dto.shootId ?? null,
    });
    const saved = await this.galleryRepo.save(item);
    await this.applyLinks(saved.id, dto);
    // Not awaited into the response: a shot is published whether or not
    // Cloudinary answers, and the placeholder is a nicety.
    void this.placeholders.refresh(saved);
    return saved;
  }

  /**
   * The links a shot carries: what is worn in it, what it is tagged with, and
   * who made it.
   *
   * Absent leaves each alone; an empty array clears it. That distinction is
   * what lets the admin panel save one section of the editor without wiping
   * the sections it did not render.
   */
  private async applyLinks(
    galleryItemId: string,
    dto: CreateGalleryItemDto | UpdateGalleryItemDto,
  ): Promise<void> {
    // `productTags` carries pins, `productIds` is the shorthand without them.
    // Both mean "these pieces"; the fuller one wins when both are sent.
    const tags = dto.productTags ?? dto.productIds;
    if (tags !== undefined) {
      await this.fitService.setProductsFor(galleryItemId, tags);
    }
    if (dto.tagIds !== undefined) {
      await this.tagsService.setTagsFor(galleryItemId, dto.tagIds);
    }
    if (dto.credits !== undefined) {
      await this.shootsService.setCredits({ galleryItemId }, dto.credits);
    }
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
      const title = dto.title?.trim() || padNumber(nextNumber++);
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
          rotation: dto.rotation ?? 0,
          sortOrder: dto.sortOrder ?? maxSort + 1 + index,
        }),
      );
    }

    const saved = await this.galleryRepo.save(rows);
    void Promise.all(saved.map((row) => this.placeholders.refresh(row)));
    return saved;
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
    const rotated =
      dto.rotation !== undefined && dto.rotation !== item.rotation;
    const replaced =
      dto.imageUrl !== undefined && dto.imageUrl !== item.imageUrl;

    if (slug !== undefined) item.slug = slug;
    if (dto.title !== undefined) item.title = dto.title;
    if (dto.description !== undefined) item.description = dto.description;
    if (dto.altText !== undefined) item.altText = dto.altText;
    if (dto.imageUrl !== undefined) item.imageUrl = dto.imageUrl;
    if (dto.width !== undefined) item.width = dto.width;
    if (dto.height !== undefined) item.height = dto.height;
    if (dto.rotation !== undefined) item.rotation = dto.rotation;
    if (dto.sortOrder !== undefined) item.sortOrder = dto.sortOrder;
    if (dto.isArchived !== undefined) item.isArchived = dto.isArchived;
    if (dto.shootId !== undefined) item.shootId = dto.shootId;

    const saved = await this.galleryRepo.save(item);
    await this.applyLinks(id, dto);
    // The placeholder is made from the delivered frame, so a rotate or a
    // re-upload invalidates it: a blur built from the stored pixels sits
    // sideways behind an upright photograph.
    if (rotated || replaced) void this.placeholders.refresh(saved);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const item = await this.galleryRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Gallery item not found');
    await this.commentRepo.delete({ targetType: 'gallery', targetId: id });
    await this.reactionRepo.delete({ targetType: 'gallery', targetId: id });
    await this.galleryRepo.delete({ id });
  }
}
