import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ENROLMENT_ROLES,
  type EnrolmentRole,
  type SeasonStatus,
  type TemplateStatus,
} from '../entities';
import type { Verdict } from '../game-admin.service';
import {
  ATTEMPT_KINDS,
  MAX_VIDEO_BYTES,
  PHOTO_MIME_TYPES,
  VIDEO_MIME_TYPES,
  type AttemptKind,
} from '../media-rules';

export class EnrolDto {
  @IsIn([...ENROLMENT_ROLES])
  role: EnrolmentRole;
}

/**
 * What the browser knows before it uploads.
 *
 * Every field here is a *claim*: the client measured its own file. The shape
 * is validated by class-validator, the values by `checkMedia`, and both run
 * again when the upload is confirmed.
 */
export class RequestUploadDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  day: number;

  @IsIn([...ATTEMPT_KINDS])
  kind: AttemptKind;

  @IsIn([...VIDEO_MIME_TYPES, ...PHOTO_MIME_TYPES])
  mimeType: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_VIDEO_BYTES)
  byteSize: number;

  /** Required for a clip, absent for a still. `checkMedia` enforces which. */
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  durationSeconds?: number;
}

export class ConfirmAttemptDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_VIDEO_BYTES)
  byteSize: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  height?: number;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  caption?: string;
}

export class FeedQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  day?: number;
}

export class AddCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  body: string;
}

export class LeaderboardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class PlayerSearchQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(24)
  q: string;
}

export class CreateSeasonDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[a-z0-9][a-z0-9-]*$/i, {
    message: 'slug can only contain letters, numbers and hyphens',
  })
  slug: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  startingHearts?: number;
}

export class SetSeasonStatusDto {
  @IsIn(['draft', 'open', 'running', 'closed'])
  status: SeasonStatus;
}

export class ReviewQueueQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  day?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class SettleAttemptDto {
  @IsIn(['approve', 'reject'])
  verdict: Verdict;

  /** Only read on an approval. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  nerve?: number;

  /** Spec 12 — one-way. */
  @IsOptional()
  @IsBoolean()
  burnHeart?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class GenerateTasksDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  tier: 1 | 2 | 3;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  count: number;

  /** Slugs already in the pool, so the model does not rewrite them. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  avoid?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  steer?: string;
}

export class ListTemplatesQueryDto {
  @IsOptional()
  @IsIn(['draft', 'approved', 'retired'])
  status?: TemplateStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  tier?: number;
}

export class AttemptIdParam {
  @IsUUID()
  id: string;
}
