import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ENROLMENT_ROLES, type EnrolmentRole } from '../entities';
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

export class AttemptIdParam {
  @IsUUID()
  id: string;
}
