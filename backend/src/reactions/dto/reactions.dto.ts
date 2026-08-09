import { IsIn, IsUUID } from 'class-validator';
import type { TargetType } from '../../common/types/target-type';
import type { ReactionType } from '../reaction.entity';

export class ToggleReactionDto {
  @IsIn(['product', 'gallery'])
  targetType: TargetType;

  @IsUUID()
  targetId: string;

  @IsIn(['like', 'dislike'])
  type: ReactionType;
}
