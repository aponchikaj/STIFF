import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Paginated, paginate } from '../common/types/paginated';
import { TargetType } from '../common/types/target-type';
import { GalleryItem } from '../gallery/gallery-item.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { FitService } from '../products/fit.service';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';
import { Comment } from './comment.entity';
import {
  AdminListCommentsQueryDto,
  CreateCommentDto,
  ListCommentsQueryDto,
  UpdateCommentDto,
} from './dto/comments.dto';

export interface PublicComment {
  id: string;
  targetType: TargetType;
  targetId: string;
  body: string;
  parentId: string | null;
  user: { id: string; username: string };
  /**
   * This person owns a paid order containing the product being commented on.
   *
   * Only ever true on product comments; a gallery shot has nothing to buy.
   * It changes how the whole thread reads, which is the point — it is a cheap
   * join against `order_items` and it is the difference between an opinion and
   * a report.
   */
  verifiedBuyer?: boolean;
  replies?: PublicComment[];
  createdAt: Date;
  updatedAt: Date;
}

function toPublicComment(
  comment: Comment,
  withReplies = false,
  buyers?: Set<string>,
): PublicComment {
  return {
    id: comment.id,
    targetType: comment.targetType,
    targetId: comment.targetId,
    body: comment.body,
    parentId: comment.parentId,
    user: { id: comment.user.id, username: comment.user.username },
    ...(buyers ? { verifiedBuyer: buyers.has(comment.userId) } : {}),
    ...(withReplies
      ? {
          replies: (comment.replies ?? [])
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map((r) => toPublicComment(r, false, buyers)),
        }
      : {}),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(GalleryItem)
    private readonly galleryRepo: Repository<GalleryItem>,
    private readonly notificationsService: NotificationsService,
    private readonly fitService: FitService,
  ) {}

  async list(query: ListCommentsQueryDto): Promise<Paginated<PublicComment>> {
    const [items, total] = await this.commentRepo.findAndCount({
      where: {
        targetType: query.targetType,
        targetId: query.targetId,
        parentId: IsNull(),
      },
      relations: { user: true, replies: { user: true } },
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.pageSize,
    });
    // One query for the whole page. Asking per comment would be N+1 against
    // the largest table in the shop.
    const buyers =
      query.targetType === 'product'
        ? await this.fitService.buyersAmong(query.targetId, [
            ...new Set(
              items.flatMap((c) => [
                c.userId,
                ...(c.replies ?? []).map((r) => r.userId),
              ]),
            ),
          ])
        : undefined;

    return paginate(
      items.map((c) => toPublicComment(c, true, buyers)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async create(user: User, dto: CreateCommentDto): Promise<PublicComment> {
    await this.assertTargetExists(dto.targetType, dto.targetId);

    let parent: Comment | null = null;
    if (dto.parentId) {
      parent = await this.commentRepo.findOne({
        where: { id: dto.parentId },
        relations: { user: true },
      });
      if (!parent) throw new NotFoundException('Parent comment not found');
      if (
        parent.targetType !== dto.targetType ||
        parent.targetId !== dto.targetId
      ) {
        throw new BadRequestException(
          'Parent comment belongs to a different target',
        );
      }
    }

    const comment = await this.commentRepo.save(
      this.commentRepo.create({
        userId: user.id,
        targetType: dto.targetType,
        targetId: dto.targetId,
        body: dto.body,
        parentId: parent?.id ?? null,
      }),
    );
    comment.user = user;

    await this.syncCommentCount(dto.targetType, dto.targetId);

    if (parent && parent.userId !== user.id) {
      await this.notificationsService.notify(
        parent.userId,
        'comment_reply',
        `${user.username} replied to your comment`,
        dto.body.slice(0, 200),
        {
          commentId: comment.id,
          targetType: dto.targetType,
          targetId: dto.targetId,
        },
      );
    }

    return toPublicComment(comment);
  }

  async update(
    user: User,
    id: string,
    dto: UpdateCommentDto,
  ): Promise<PublicComment> {
    const comment = await this.commentRepo.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== user.id) {
      throw new ForbiddenException('You can only edit your own comments');
    }
    comment.body = dto.body;
    await this.commentRepo.save(comment);
    return toPublicComment(comment);
  }

  async remove(user: User, id: string): Promise<void> {
    const comment = await this.commentRepo.findOne({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('You can only delete your own comments');
    }
    // Replies cascade via FK.
    await this.commentRepo.delete({ id });
    await this.syncCommentCount(comment.targetType, comment.targetId);
  }

  async adminList(
    query: AdminListCommentsQueryDto,
  ): Promise<Paginated<PublicComment>> {
    const qb = this.commentRepo
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.user', 'user');
    if (query.search) {
      qb.andWhere('comment.body ILIKE :search', {
        search: `%${query.search}%`,
      });
    }
    if (query.userId) {
      qb.andWhere('comment.userId = :userId', { userId: query.userId });
    }
    qb.orderBy('comment.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.pageSize);

    const [items, total] = await qb.getManyAndCount();
    return paginate(
      items.map((c) => toPublicComment(c)),
      total,
      query.page,
      query.pageSize,
    );
  }

  private async syncCommentCount(
    targetType: TargetType,
    targetId: string,
  ): Promise<void> {
    const commentCount = await this.commentRepo.count({
      where: { targetType, targetId },
    });
    if (targetType === 'product') {
      await this.productRepo.update({ id: targetId }, { commentCount });
    } else {
      await this.galleryRepo.update({ id: targetId }, { commentCount });
    }
  }

  private async assertTargetExists(
    targetType: TargetType,
    targetId: string,
  ): Promise<void> {
    const exists =
      targetType === 'product'
        ? await this.productRepo.exists({ where: { id: targetId } })
        : await this.galleryRepo.exists({ where: { id: targetId } });
    if (!exists) throw new NotFoundException(`${targetType} not found`);
  }
}
