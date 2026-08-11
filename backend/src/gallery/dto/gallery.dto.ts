import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateGalleryItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  // Optional override for the stable URL slug. If omitted, the service uses
  // `title` (preserving the previous behavior where title==slug).
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @MinLength(1)
  imageUrl: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  height?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateGalleryItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  // Updating slug is allowed (admin flow), but it must remain unique.
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  imageUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  height?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}

export class ListGalleryQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['newest', 'popular'])
  sort?: 'newest' | 'popular';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeArchived?: boolean;
}
