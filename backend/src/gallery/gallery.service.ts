import { Injectable, NotFoundException } from '@nestjs/common';
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

export type GalleryItemWithReaction = GalleryItem & {
  myReaction: ReactionType | null;
};

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

  async getById(id: string, user?: User): Promise<GalleryItemWithReaction> {
    const item = await this.galleryRepo.findOne({ where: { id } });
    if (!item || (item.isArchived && user?.role !== 'admin')) {
      throw new NotFoundException('Gallery item not found');
    }

    let myReaction: ReactionType | null = null;
    if (user) {
      const reaction = await this.reactionRepo.findOne({
        where: { userId: user.id, targetType: 'gallery', targetId: id },
      });
      myReaction = reaction?.type ?? null;
    }
    return { ...item, myReaction };
  }

  async create(dto: CreateGalleryItemDto): Promise<GalleryItem> {
    const item = this.galleryRepo.create({
      title: dto.title,
      description: dto.description ?? null,
      imageUrl: dto.imageUrl,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.galleryRepo.save(item);
  }

  async update(id: string, dto: UpdateGalleryItemDto): Promise<GalleryItem> {
    const item = await this.galleryRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Gallery item not found');

    if (dto.title !== undefined) item.title = dto.title;
    if (dto.description !== undefined) item.description = dto.description;
    if (dto.imageUrl !== undefined) item.imageUrl = dto.imageUrl;
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
