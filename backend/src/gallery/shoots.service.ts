import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { slugify } from '../common/utils/slug';
import { User } from '../users/user.entity';
import { CreditInputDto, ShootInputDto } from './dto/shoot.dto';
import { GalleryCredit } from './gallery-credit.entity';
import { GalleryItem } from './gallery-item.entity';
import { GalleryShoot } from './gallery-shoot.entity';

/** A shoot as the index page needs it: something to show, and how much of it. */
export interface ShootSummary extends GalleryShoot {
  cover: GalleryItem | null;
  shotCount: number;
}

export interface ShootDetail extends ShootSummary {
  items: GalleryItem[];
}

@Injectable()
export class ShootsService {
  constructor(
    @InjectRepository(GalleryShoot)
    private readonly shootRepo: Repository<GalleryShoot>,
    @InjectRepository(GalleryCredit)
    private readonly creditRepo: Repository<GalleryCredit>,
    @InjectRepository(GalleryItem)
    private readonly itemRepo: Repository<GalleryItem>,
  ) {}

  private canSeeUnpublished(user?: User): boolean {
    return user?.role === 'admin';
  }

  /**
   * Every shoot, each with a cover and a count.
   *
   * The covers and counts are two queries for the whole list rather than two
   * per shoot; the naive version is 2N against the largest table here.
   */
  async list(user?: User): Promise<ShootSummary[]> {
    const shoots = await this.shootRepo.find({
      where: this.canSeeUnpublished(user) ? {} : { isPublished: true },
      order: { sortOrder: 'ASC', shotOn: 'DESC', createdAt: 'DESC' },
    });
    if (shoots.length === 0) return [];

    const ids = shoots.map((shoot) => shoot.id);
    const [items, counts] = await Promise.all([
      this.itemRepo.find({
        where: { shootId: In(ids), isArchived: false },
        order: { sortOrder: 'ASC', createdAt: 'DESC' },
      }),
      this.shotCounts(ids),
    ]);

    // First in archive order, which is the fallback when nobody picked a cover.
    const firstOf = new Map<string, GalleryItem>();
    const byId = new Map(items.map((item) => [item.id, item]));
    for (const item of items) {
      if (item.shootId && !firstOf.has(item.shootId)) {
        firstOf.set(item.shootId, item);
      }
    }

    return shoots.map((shoot) => ({
      ...shoot,
      cover:
        (shoot.coverItemId ? byId.get(shoot.coverItemId) : undefined) ??
        firstOf.get(shoot.id) ??
        null,
      shotCount: counts.get(shoot.id) ?? 0,
    }));
  }

  private async shotCounts(shootIds: string[]): Promise<Map<string, number>> {
    const rows = await this.itemRepo
      .createQueryBuilder('item')
      .select('item."shootId"', 'shootId')
      .addSelect('COUNT(*)', 'count')
      .where('item."shootId" IN (:...shootIds)', { shootIds })
      .andWhere('item."isArchived" = false')
      .groupBy('item."shootId"')
      .getRawMany<{ shootId: string; count: string }>();
    return new Map(rows.map((row) => [row.shootId, Number(row.count)]));
  }

  async getBySlug(slug: string, user?: User): Promise<ShootDetail> {
    const shoot = await this.shootRepo.findOne({ where: { slug } });
    if (!shoot || (!shoot.isPublished && !this.canSeeUnpublished(user))) {
      throw new NotFoundException('Shoot not found');
    }

    const items = await this.itemRepo.find({
      where: { shootId: shoot.id, isArchived: false },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
    const credits = await this.creditsForShoot(shoot.id);

    return {
      ...shoot,
      credits,
      items,
      cover:
        items.find((item) => item.id === shoot.coverItemId) ?? items[0] ?? null,
      shotCount: items.length,
    };
  }

  creditsForShoot(shootId: string): Promise<GalleryCredit[]> {
    return this.creditRepo.find({
      where: { shootId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * A frame's own credits, falling back to its shoot's.
   *
   * The fallback is the point: one photographer is credited once on the shoot
   * and appears on all fifteen frames, and a model who is in only one of them
   * is credited there.
   */
  async creditsForItem(
    galleryItemId: string,
    shootId: string | null,
  ): Promise<GalleryCredit[]> {
    const [own, inherited] = await Promise.all([
      this.creditRepo.find({
        where: { galleryItemId },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      }),
      shootId ? this.creditsForShoot(shootId) : Promise.resolve([]),
    ]);

    // A frame-level credit replaces the shoot's for the same role and person;
    // anything else adds to it.
    const claimed = new Set(own.map((credit) => this.identity(credit)));
    return [
      ...own,
      ...inherited.filter((credit) => !claimed.has(this.identity(credit))),
    ];
  }

  private identity(credit: GalleryCredit): string {
    return `${credit.role}:${credit.name.trim().toLowerCase()}`;
  }

  private async assertSlugFree(slug: string, exceptId?: string) {
    const clash = await this.shootRepo.findOne({ where: { slug } });
    if (clash && clash.id !== exceptId) {
      throw new ConflictException(
        `"${slug}" is already used by another shoot, and slugs must be unique.`,
      );
    }
  }

  async create(dto: ShootInputDto): Promise<GalleryShoot> {
    const slug = slugify(dto.slug ?? dto.title ?? '');
    await this.assertSlugFree(slug);
    const shoot = await this.shootRepo.save(
      this.shootRepo.create({
        slug,
        title: dto.title,
        description: dto.description ?? null,
        location: dto.location ?? null,
        shotOn: dto.shotOn ?? null,
        coverItemId: dto.coverItemId ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isPublished: dto.isPublished ?? true,
      }),
    );
    if (dto.credits) await this.setCredits({ shootId: shoot.id }, dto.credits);
    if (dto.itemIds) await this.setItems(shoot.id, dto.itemIds);
    return shoot;
  }

  async update(id: string, dto: ShootInputDto): Promise<GalleryShoot> {
    const shoot = await this.shootRepo.findOne({ where: { id } });
    if (!shoot) throw new NotFoundException('Shoot not found');

    if (dto.slug !== undefined || dto.title !== undefined) {
      const slug = slugify(dto.slug ?? dto.title ?? shoot.title);
      if (slug !== shoot.slug) {
        await this.assertSlugFree(slug, id);
        shoot.slug = slug;
      }
    }
    if (dto.title !== undefined) shoot.title = dto.title;
    if (dto.description !== undefined) shoot.description = dto.description;
    if (dto.location !== undefined) shoot.location = dto.location;
    if (dto.shotOn !== undefined) shoot.shotOn = dto.shotOn;
    if (dto.coverItemId !== undefined) shoot.coverItemId = dto.coverItemId;
    if (dto.sortOrder !== undefined) shoot.sortOrder = dto.sortOrder;
    if (dto.isPublished !== undefined) shoot.isPublished = dto.isPublished;

    const saved = await this.shootRepo.save(shoot);
    if (dto.credits !== undefined) {
      await this.setCredits({ shootId: id }, dto.credits);
    }
    if (dto.itemIds !== undefined) await this.setItems(id, dto.itemIds);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const shoot = await this.shootRepo.findOne({ where: { id } });
    if (!shoot) throw new NotFoundException('Shoot not found');
    // Its shots survive it: `ON DELETE SET NULL` puts them back in the
    // ungrouped archive rather than deleting photographs.
    await this.shootRepo.delete({ id });
  }

  /**
   * Replaces the shoot's roll with exactly these shots.
   *
   * Two statements rather than a loop: everything currently pointing here is
   * released, then the named shots are claimed. A shot moved between shoots
   * lands in exactly one.
   */
  private async setItems(shootId: string, itemIds: string[]): Promise<void> {
    await this.itemRepo.manager.transaction(async (manager) => {
      await manager.update(GalleryItem, { shootId }, { shootId: null });
      const wanted = [...new Set(itemIds)];
      if (wanted.length > 0) {
        await manager.update(GalleryItem, { id: In(wanted) }, { shootId });
      }
      // A cover that just left the shoot would otherwise keep pointing at a
      // frame the shoot no longer contains.
      await manager
        .createQueryBuilder()
        .update(GalleryShoot)
        .set({ coverItemId: null })
        .where('"id" = :shootId', { shootId })
        .andWhere('"coverItemId" IS NOT NULL')
        .andWhere(
          '"coverItemId" NOT IN (SELECT "id" FROM "gallery_items" WHERE "shootId" = :shootId)',
        )
        .execute();
    });
  }

  /** Replaces one owner's credits with exactly what was submitted. */
  async setCredits(
    owner: { shootId: string } | { galleryItemId: string },
    credits: CreditInputDto[],
  ): Promise<void> {
    const where =
      'shootId' in owner
        ? { shootId: owner.shootId }
        : { galleryItemId: owner.galleryItemId };

    await this.creditRepo.manager.transaction(async (manager) => {
      await manager.delete(GalleryCredit, where);
      if (credits.length === 0) return;
      await manager.insert(
        GalleryCredit,
        credits.map((credit, index) => ({
          shootId: 'shootId' in owner ? owner.shootId : null,
          galleryItemId: 'galleryItemId' in owner ? owner.galleryItemId : null,
          role: credit.role,
          name: credit.name.trim(),
          // Typed with or without the @, stored without, so the handle and
          // the profile URL both come from one value.
          instagram: credit.instagram?.trim().replace(/^@/, '') || null,
          url: credit.url?.trim() || null,
          sortOrder: credit.sortOrder ?? index,
        })),
      );
    });
  }

  /** Shots not yet in any shoot, which is what the admin assigner starts from. */
  ungrouped(): Promise<GalleryItem[]> {
    return this.itemRepo.find({
      where: { shootId: IsNull() },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
      take: 200,
    });
  }
}
