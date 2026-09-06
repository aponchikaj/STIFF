import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateSeasonDto,
  ReviewQueueQueryDto,
  SetSeasonStatusDto,
  SettleAttemptDto,
} from './dto/game.dto';
import { GameAdminService } from './game-admin.service';

/**
 * `/api/game/admin/*` — running a season.
 *
 * `@Roles('admin')` at the class level, which is also what lets an
 * admin.stiff.ge session reach these at all: the shop's guard admits an admin
 * token only to routes that are `@Roles('admin')`, explicitly `@AdminAllowed()`,
 * or a `@Public()` read. Nothing here is public and nothing here is read-only
 * convenience, so the role is the whole gate.
 *
 * These live beside the game's own controllers rather than in `src/admin/`,
 * matching how the panel already edits products and orders — one
 * implementation of "publish an attempt", not two that drift.
 */
@Controller('game/admin')
@Roles('admin')
export class GameAdminController {
  constructor(private readonly gameAdminService: GameAdminService) {}

  @Get('seasons')
  async seasons() {
    return { seasons: await this.gameAdminService.listSeasons() };
  }

  @Post('seasons')
  createSeason(@Body() dto: CreateSeasonDto) {
    return this.gameAdminService.createSeason(dto);
  }

  @Patch('seasons/:id/status')
  setSeasonStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetSeasonStatusDto,
  ) {
    return this.gameAdminService.setSeasonStatus(id, dto.status);
  }

  /** What is waiting for a verdict. Oldest first. */
  @Get('review')
  review(@Query() query: ReviewQueueQueryDto) {
    return this.gameAdminService.reviewQueue(query);
  }

  /** The only thing that puts an attempt into the feed. */
  @Post('attempts/:id/settle')
  @HttpCode(200)
  settle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SettleAttemptDto,
  ) {
    return this.gameAdminService.settle(id, dto);
  }

  @Post('attempts/:id/unpublish')
  @HttpCode(200)
  unpublish(@Param('id', ParseUUIDPipe) id: string) {
    return this.gameAdminService.unpublish(id);
  }
}
