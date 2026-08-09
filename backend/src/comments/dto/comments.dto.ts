import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { TargetType } from '../../common/types/target-type';

export class ListCommentsQueryDto extends PaginationDto {
  @IsIn(['product', 'gallery'])
  targetType: TargetType;

  @IsUUID()
  targetId: string;
}

export class CreateCommentDto {
  @IsIn(['product', 'gallery'])
  targetType: TargetType;

  @IsUUID()
  targetId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body: string;
}

export class AdminListCommentsQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}
