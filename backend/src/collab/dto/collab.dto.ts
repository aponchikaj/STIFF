import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { HARD_MAX_CODES } from '../collab.constants';

export class RedeemCollabDto {
  @IsString()
  @MinLength(16)
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9_-]+$/)
  token: string;
}

export class GenerateCodesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(HARD_MAX_CODES)
  count?: number;
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(HARD_MAX_CODES)
  maxCodes?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value as unknown;
  })
  @IsBoolean()
  strictMode?: boolean;
}

export class ListCodesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(HARD_MAX_CODES)
  pageSize: number = 50;

  @IsOptional()
  @IsIn(['unused', 'claimed', 'revoked'])
  status?: 'unused' | 'claimed' | 'revoked';
}

export class UpdateCodeDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;
}
