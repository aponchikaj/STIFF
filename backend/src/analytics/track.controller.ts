import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { Throttle } from '@nestjs/throttler';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { User } from '../users/user.entity';
import { AnalyticsService } from './analytics.service';

class TrackDto {
  @IsString()
  @Matches(/^\/\S*$/)
  @MaxLength(200)
  path: string;

  @IsUUID()
  visitorId: string;
}

/**
 * The events the site is allowed to report.
 *
 * A closed list rather than free text: this endpoint is public and unauthenticated,
 * and an open `name` column is an invitation to fill the table with whatever
 * somebody feels like posting.
 */
const TRACKABLE = ['section_view', 'intro_shown', 'intro_skipped'] as const;

class TrackEventDto {
  @IsIn([...TRACKABLE])
  name: (typeof TRACKABLE)[number];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;
}

class TrackEventsDto {
  @IsString()
  @Matches(/^\/\S*$/)
  @MaxLength(200)
  path: string;

  @IsUUID()
  visitorId: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TrackEventDto)
  events: TrackEventDto[];
}

@Controller('track')
export class TrackController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Public()
  @Post()
  @HttpCode(204)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async track(@Body() dto: TrackDto, @CurrentUser() user?: User) {
    await this.analyticsService.recordView(
      dto.path,
      dto.visitorId,
      user?.id ?? null,
    );
  }

  /**
   * A batch of named moments from one visit.
   *
   * Batched because scrolling fires several in a few seconds. The limit is
   * higher than the page-view one for the same reason, and the array is capped
   * so one request cannot insert a thousand rows.
   */
  @Public()
  @Post('events')
  @HttpCode(204)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async trackEvents(@Body() dto: TrackEventsDto, @CurrentUser() user?: User) {
    await this.analyticsService.recordEvents(
      dto.path,
      dto.visitorId,
      user?.id ?? null,
      dto.events,
    );
  }
}
