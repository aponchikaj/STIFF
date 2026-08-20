import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CREDIT_ROLES } from '../gallery-credit.entity';
import type { CreditRole } from '../gallery-credit.entity';
import { TAG_KINDS } from '../gallery-tag.entity';
import type { TagKind } from '../gallery-tag.entity';

export class CreditInputDto {
  @IsIn([...CREDIT_ROLES])
  role: CreditRole;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  /** Accepted with or without the leading @; stored without. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  instagram?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  url?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/**
 * One shape for create and update.
 *
 * `title` is required in practice for a create and the service defaults the
 * slug from it; making it optional here is what lets an update send one field.
 * Absent leaves a field alone, which is the usual distinction from "set to
 * nothing" that `credits: []` and `itemIds: []` rely on.
 */
export class ShootInputDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  /** A calendar day, `YYYY-MM-DD`. A shoot has no meaningful hour. */
  @IsOptional()
  @IsISO8601({ strict: true })
  shotOn?: string;

  @IsOptional()
  @IsUUID()
  coverItemId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  /** The whole roll, in order. Replaces whatever the shoot held before. */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(500)
  itemIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CreditInputDto)
  credits?: CreditInputDto[];
}

export class TagInputDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsIn([...TAG_KINDS])
  kind?: TagKind;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class ListShootsQueryDto {
  /** Admin only, and ignored for everyone else. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeEmpty?: boolean;
}
