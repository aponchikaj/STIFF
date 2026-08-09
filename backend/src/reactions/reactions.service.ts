import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TargetType } from '../common/types/target-type';
import { GalleryItem } from '../gallery/gallery-item.entity';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';
import { ToggleReactionDto } from './dto/reactions.dto';
import { Reaction, ReactionType } from './reaction.entity';

export interface ReactionResult {
  myReaction: ReactionType | null;
  likeCount: number;
  dislikeCount: number;
}

@Injectable()
export class ReactionsService {
  constructor(
    @InjectRepository(Reaction)
    private readonly reactionRepo: Repository<Reaction>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(GalleryItem)
    private readonly galleryRepo: Repository<GalleryItem>,
  ) {}

  async toggle(user: User, dto: ToggleReactionDto): Promise<ReactionResult> {
    await this.assertTargetExists(dto.targetType, dto.targetId);

    const existing = await this.reactionRepo.findOne({
      where: {
        userId: user.id,
        targetType: dto.targetType,
        targetId: dto.targetId,
      },
    });

    let myReaction: ReactionType | null;
    if (!existing) {
      await this.reactionRepo.save(
        this.reactionRepo.create({
          userId: user.id,
          targetType: dto.targetType,
          targetId: dto.targetId,
          type: dto.type,
        }),
      );
      myReaction = dto.type;
    } else if (existing.type === dto.type) {
      await this.reactionRepo.delete({ id: existing.id });
      myReaction = null;
    } else {
      existing.type = dto.type;
      await this.reactionRepo.save(existing);
      myReaction = dto.type;
    }

    const counts = await this.syncCounters(dto.targetType, dto.targetId);
    return { myReaction, ...counts };
  }

  /** Recounts from the source of truth and updates the denormalized columns. */
  private async syncCounters(
    targetType: TargetType,
    targetId: string,
  ): Promise<{ likeCount: number; dislikeCount: number }> {
    const [likeCount, dislikeCount] = await Promise.all([
      this.reactionRepo.count({
        where: { targetType, targetId, type: 'like' },
      }),
      this.reactionRepo.count({
        where: { targetType, targetId, type: 'dislike' },
      }),
    ]);

    if (targetType === 'product') {
      await this.productRepo.update(
        { id: targetId },
        { likeCount, dislikeCount },
      );
    } else {
      await this.galleryRepo.update(
        { id: targetId },
        { likeCount, dislikeCount },
      );
    }
    return { likeCount, dislikeCount };
  }

  private async assertTargetExists(
    targetType: TargetType,
    targetId: string,
  ): Promise<void> {
    const exists =
      targetType === 'product'
        ? await this.productRepo.exists({ where: { id: targetId } })
        : await this.galleryRepo.exists({ where: { id: targetId } });
    if (!exists) {
      throw new NotFoundException(`${targetType} not found`);
    }
  }
}
