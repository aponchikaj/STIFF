import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, IsUUID, Matches, MaxLength } from 'class-validator';
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
}
