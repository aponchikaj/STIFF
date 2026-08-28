import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '../users/user.entity';
import { StartRunDto, SubmitRunDto } from './dto/runs.dto';
import { RunsService } from './runs.service';

/**
 * Playing for score. Authenticated throughout — an anonymous visitor gets the
 * demo gate on the landing page, not a leaderboard entry.
 */
@Controller('game/runs')
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  /**
   * Rate-limited harder than the default. Opening a run is cheap for the
   * client and costs the server a row, so it is the obvious thing to hammer.
   */
  @Post('start')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  start(@CurrentUser() user: User, @Body() dto: StartRunDto) {
    return this.runs.start(user.id, dto.chartId, dto.practiceMode ?? false);
  }

  @Post('submit')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  submit(@CurrentUser() user: User, @Body() dto: SubmitRunDto) {
    return this.runs.submit(user.id, dto);
  }

  @Get('mine')
  recent(@CurrentUser() user: User) {
    return this.runs.recentFor(user.id);
  }

  @Get(':id')
  one(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.runs.oneFor(user.id, id);
  }
}
