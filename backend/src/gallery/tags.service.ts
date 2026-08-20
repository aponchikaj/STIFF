import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { slugify } from '../common/utils/slug';
import { TagInputDto } from './dto/shoot.dto';
import { GalleryTag } from './gallery-tag.entity';

/** A tag with how many live shots carry it, which is what the filter bar shows. */
export interface TagWithCount extends GalleryTag {
  count: number;
}

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(GalleryTag)
    private readonly tagRepo: Repository<GalleryTag>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Every tag, with its live count.
   *
   * `includeEmpty` is the admin's view. The public filter bar drops zeroes:
   * a filter that is guaranteed to return nothing is worse than no filter,
   * and tags outlive the shots that were deleted from under them.
   */
  async list(includeEmpty = false): Promise<TagWithCount[]> {
    const tags = await this.tagRepo.find({
      order: { kind: 'ASC', sortOrder: 'ASC', label: 'ASC' },
    });
    if (tags.length === 0) return [];

    const counts = await this.counts(tags.map((tag) => tag.id));
    const withCounts = tags.map((tag) => ({
      ...tag,
      count: counts.get(tag.id) ?? 0,
    }));
    return includeEmpty
      ? withCounts
      : withCounts.filter((tag) => tag.count > 0);
  }

  private async counts(tagIds: string[]): Promise<Map<string, number>> {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('link."tagId"', 'tagId')
      .addSelect('COUNT(*)', 'count')
      .from('gallery_item_tags', 'link')
      .innerJoin('gallery_items', 'item', 'item."id" = link."galleryItemId"')
      .where('link."tagId" IN (:...tagIds)', { tagIds })
      .andWhere('item."isArchived" = false')
      .groupBy('link."tagId"')
      .getRawMany<{ tagId: string; count: string }>();
    return new Map(rows.map((row) => [row.tagId, Number(row.count)]));
  }

  /** The tags on one shot, in the order the filter bar groups them. */
  tagsFor(galleryItemId: string): Promise<GalleryTag[]> {
    return this.dataSource
      .getRepository(GalleryTag)
      .createQueryBuilder('tag')
      .innerJoin('gallery_item_tags', 'link', 'link."tagId" = tag."id"')
      .where('link."galleryItemId" = :galleryItemId', { galleryItemId })
      .orderBy('tag."kind"', 'ASC')
      .addOrderBy('tag."sortOrder"', 'ASC')
      .addOrderBy('tag."label"', 'ASC')
      .getMany();
  }

  /** The same lookup for a page of shots, without N+1. */
  async tagsForMany(
    galleryItemIds: string[],
  ): Promise<Map<string, GalleryTag[]>> {
    const byItem = new Map<string, GalleryTag[]>();
    if (galleryItemIds.length === 0) return byItem;

    const rows = await this.dataSource
      .createQueryBuilder()
      .select('link."galleryItemId"', 'galleryItemId')
      .addSelect('tag."id"', 'id')
      .addSelect('tag."slug"', 'slug')
      .addSelect('tag."label"', 'label')
      .addSelect('tag."kind"', 'kind')
      .from('gallery_item_tags', 'link')
      .innerJoin('gallery_tags', 'tag', 'tag."id" = link."tagId"')
      .where('link."galleryItemId" IN (:...ids)', { ids: galleryItemIds })
      .orderBy('tag."kind"', 'ASC')
      .addOrderBy('tag."sortOrder"', 'ASC')
      .getRawMany<{ galleryItemId: string } & GalleryTag>();

    for (const { galleryItemId, ...tag } of rows) {
      const list = byItem.get(galleryItemId) ?? [];
      list.push(tag);
      byItem.set(galleryItemId, list);
    }
    return byItem;
  }

  private async assertSlugFree(slug: string, exceptId?: string) {
    const clash = await this.tagRepo.findOne({ where: { slug } });
    if (clash && clash.id !== exceptId) {
      throw new ConflictException(`"${slug}" is already a tag.`);
    }
  }

  async create(dto: TagInputDto): Promise<GalleryTag> {
    const slug = slugify(dto.slug ?? dto.label ?? '');
    await this.assertSlugFree(slug);
    return this.tagRepo.save(
      this.tagRepo.create({
        slug,
        label: dto.label,
        kind: dto.kind ?? 'theme',
        sortOrder: dto.sortOrder ?? 0,
      }),
    );
  }

  async update(id: string, dto: TagInputDto): Promise<GalleryTag> {
    const tag = await this.tagRepo.findOne({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found');

    if (dto.slug !== undefined) {
      const slug = slugify(dto.slug);
      if (slug !== tag.slug) {
        await this.assertSlugFree(slug, id);
        tag.slug = slug;
      }
    }
    if (dto.label !== undefined) tag.label = dto.label;
    if (dto.kind !== undefined) tag.kind = dto.kind;
    if (dto.sortOrder !== undefined) tag.sortOrder = dto.sortOrder;
    return this.tagRepo.save(tag);
  }

  async remove(id: string): Promise<void> {
    const tag = await this.tagRepo.findOne({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found');
    // The links go with it via ON DELETE CASCADE; the photographs do not.
    await this.tagRepo.delete({ id });
  }

  /** Replaces a shot's tags with exactly what the admin submitted. */
  async setTagsFor(galleryItemId: string, tagIds: string[]): Promise<void> {
    const wanted = [...new Set(tagIds)];
    await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .delete()
        .from('gallery_item_tags')
        .where('"galleryItemId" = :galleryItemId', { galleryItemId })
        .execute();
      if (wanted.length === 0) return;

      // Only ids that resolve. A stale id from a stale admin tab would
      // otherwise fail the whole save on a foreign key.
      const live = await manager.getRepository(GalleryTag).find({
        where: { id: In(wanted) },
        select: { id: true },
      });
      if (live.length === 0) return;

      await manager
        .createQueryBuilder()
        .insert()
        .into('gallery_item_tags', ['galleryItemId', 'tagId'])
        .values(live.map((tag) => ({ galleryItemId, tagId: tag.id })))
        .orIgnore()
        .execute();
    });
  }
}
