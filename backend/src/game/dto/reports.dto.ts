import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  CLOSING_STATUSES,
  MAX_CONTEXT_LENGTH,
  MAX_DETAILS_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_REPORT_TAGS,
  MAX_REPORTER_MESSAGE_LENGTH,
  REPORT_ACTIONS,
  REPORT_STATUSES,
  REPORT_TARGET_TYPES,
  type ClosingStatus,
  type ReportAction,
  type ReportStatus,
  type ReportTargetType,
} from '../reports/report-rules';

/**
 * A report. `targetId` for everything but `app`; a `user` may be named by
 * `handle` instead, because that is all the feed and the board ever show.
 * The reason is checked against the target type in the service, where the
 * answer also depends on whose thing it is.
 */
export class CreateReportDto {
  @IsIn([...REPORT_TARGET_TYPES])
  targetType: ReportTargetType;

  @IsOptional()
  @IsUUID()
  targetId?: string;

  /** For `user` only: the handle shown on the feed, the board or a comment. */
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(24)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'handle can only contain letters, numbers and underscores',
  })
  handle?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(32)
  @Matches(/^[a-z_]+$/, { message: 'reason must be one of the listed ids' })
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_DETAILS_LENGTH)
  details?: string;

  /** Blocklist ids — which kind of dangerous. Unknown ones are dropped. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_REPORT_TAGS)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  tags?: string[];

  /** Where in the app: a path or a screen name. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CONTEXT_LENGTH)
  context?: string;
}

export class ListMyReportsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

// ------------------------------------------------------------------ admin --

export class ListReportsQueryDto {
  /** Default: the queue — `open` and `reviewing`. */
  @IsOptional()
  @IsIn([...REPORT_STATUSES, 'queue', 'closed', 'all'])
  status?: ReportStatus | 'queue' | 'closed' | 'all';

  @IsOptional()
  @IsIn([...REPORT_TARGET_TYPES])
  targetType?: ReportTargetType;

  @IsOptional()
  @IsUUID()
  targetId?: string;

  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsOptional()
  @IsUUID()
  reporterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  reason?: string;

  /** Only reports at this priority or above. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  minPriority?: number;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  offset?: number;
}

export class ClaimReportDto {
  /** Take it even if another admin already has. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class SetReportPriorityDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  priority: number;
}

/**
 * Closing a report. `action` is what was done and must fit the target
 * (`ACTIONS_FOR_TARGET`); the service performs it. `note` stays internal;
 * `reporterMessage` is what the reporter is told beyond the outcome.
 */
export class ResolveReportDto {
  @IsIn([...CLOSING_STATUSES])
  status: ClosingStatus;

  @IsOptional()
  @IsIn([...REPORT_ACTIONS])
  action?: ReportAction;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_REPORTER_MESSAGE_LENGTH)
  reporterMessage?: string;

  /** Close every other open report on the same thing the same way. Default true. */
  @IsOptional()
  @IsBoolean()
  includeSiblings?: boolean;

  /** Tell the reporter(s). Default true. */
  @IsOptional()
  @IsBoolean()
  notifyReporter?: boolean;
}
