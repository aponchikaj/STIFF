import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
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
  NotEquals,
} from 'class-validator';
import {
  ENROLMENT_ROLES,
  ENROLMENT_STATUSES,
  PURCHASE_STATUSES,
  SHOP_ITEM_STATUSES,
  TASK_MODES,
  VOTE_VALUES,
  type PurchaseStatus,
  type ShopItemStatus,
  type TaskMode,
  type VoteValue,
  type EnrolmentRole,
  type EnrolmentStatus,
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

  /**
   * `YYYY-MM-DD`. Required the first time an account tries to take a side and
   * has no date of birth on record — a shop account made on stiff.ge was never
   * asked. Ignored once one is recorded.
   */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  birthDate?: string;
}

/**
 * The game's sign-up: a side, a name, a password, and a date of birth.
 *
 * No email. The game asks for the least it can and still make an account —
 * someone who wants password resets and order mail adds an address in
 * settings afterwards. The username and password rules are the shop's own
 * (`RegisterDto`), restated rather than inherited because inheriting would
 * drag the email requirement along.
 *
 * The date of birth is checked *before* the account is made. The game is 16+
 * strictly, and refusing after creating would leave a shop account behind for
 * someone we just told cannot be here.
 */
export class GameRegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(24)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username can only contain letters, numbers and underscores',
  })
  username: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsIn([...ENROLMENT_ROLES])
  role: EnrolmentRole;

  @IsString()
  @MaxLength(30)
  birthDate: string;

  /** Optional. Someone who gives one gets the verification mail. */
  @IsOptional()
  @IsEmail()
  email?: string;
}

/**
 * What the browser knows before it uploads.
 *
 * Every field here is a *claim*: the client measured its own file. The shape
 * is validated by class-validator, the values by `checkMedia`, and both run
 * again when the upload is confirmed.
 */
export class RequestUploadDto {
  /**
   * The accepted task this is the hand-in for. Required: every hand-in is
   * against a clock, and the assignment is where the clock is. The day and
   * the task come from it.
   */
  @IsUUID()
  assignmentId: string;

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

export class DrawTaskDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  day: number;
}

export class PlayableTasksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  tier?: number;

  @IsOptional()
  @IsIn([...TASK_MODES])
  mode?: TaskMode;
}

export class VoteDto {
  @IsIn([...VOTE_VALUES])
  vote: VoteValue;
}

export class CreateShopItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  imageUrl?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  priceCoins: number;

  /** Omit for unlimited. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  perPersonLimit?: number;

  @IsOptional()
  @IsIn([...SHOP_ITEM_STATUSES])
  status?: ShopItemStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1000)
  @Max(1000)
  sortOrder?: number;
}

export class UpdateShopItemDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  imageUrl?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  priceCoins?: number;

  /** Send null for unlimited. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  perPersonLimit?: number | null;

  @IsOptional()
  @IsIn([...SHOP_ITEM_STATUSES])
  status?: ShopItemStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1000)
  @Max(1000)
  sortOrder?: number;
}

export class ListShopItemsQueryDto {
  @IsOptional()
  @IsIn([...SHOP_ITEM_STATUSES])
  status?: ShopItemStatus;
}

export class ListPurchasesQueryDto {
  @IsOptional()
  @IsIn([...PURCHASE_STATUSES])
  status?: PurchaseStatus;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class SetPurchaseStatusDto {
  @IsIn(['fulfilled', 'cancelled'])
  status: 'fulfilled' | 'cancelled';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CreateClanDto {
  @IsString()
  @MinLength(3)
  @MaxLength(24)
  name: string;
}

export class JoinClanDto {
  @IsString()
  @MinLength(4)
  @MaxLength(12)
  code: string;
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

/** A person, not the model, calling it. Same consequence either way. */
export class FlagCheaterDto {
  /** The attempt that proves it, if there is one. It is rejected too. */
  @IsOptional()
  @IsUUID()
  attemptId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ReinstateDto {
  /** Put the zeroed Nerve and hearts back from the snapshot. Default true. */
  @IsOptional()
  @IsBoolean()
  restore?: boolean;
}

/**
 * A correction to one player's score, by a person, on the record.
 *
 * Bounded either way: nothing an admin does by hand should move a season by
 * more than a template can pay, and a zeroing has its own route with its own
 * consequences (`flag-cheater`).
 */
export class AdjustScoreDto {
  @Type(() => Number)
  @IsInt()
  @Min(-10_000)
  @Max(10_000)
  @NotEquals(0)
  delta: number;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason: string;
}

export class ScoreLedgerQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class ListEnrolmentsQueryDto {
  @IsOptional()
  @IsIn([...ENROLMENT_STATUSES])
  status?: EnrolmentStatus;

  @IsOptional()
  @IsIn([...ENROLMENT_ROLES])
  role?: EnrolmentRole;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
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

  /** Ask for solo or team tasks only; unset lets the creator mix. */
  @IsOptional()
  @IsIn([...TASK_MODES])
  mode?: TaskMode;
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
