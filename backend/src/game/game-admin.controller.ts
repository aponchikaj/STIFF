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
  GenerateTasksDto,
  ListTemplatesQueryDto,
  ReviewQueueQueryDto,
  SetSeasonStatusDto,
  SettleAttemptDto,
} from './dto/game.dto';
import { GameAdminService } from './game-admin.service';
import { TaskGeneratorService } from './ai/task-generator.service';
import { TaskTemplatesService } from './task-templates.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { CHARTER_HASH } from './ai/charter';

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
  constructor(
    private readonly gameAdminService: GameAdminService,
    private readonly taskGenerator: TaskGeneratorService,
    private readonly templates: TaskTemplatesService,
  ) {}

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

  /**
   * Claude writes candidate tasks; the exclusion screen decides which survive;
   * the survivors are filed as drafts.
   *
   * Nothing here publishes — approval is a separate, human act. The reply
   * carries what was saved *and* what the screen refused, and both are now
   * persisted: a rejection rate that climbs is the first sign a Charter edit
   * stopped holding, and that is only measurable if the rejections outlive the
   * response.
   *
   * The existing pool is passed to the model as `avoid` automatically, so a
   * caller cannot forget to and get twenty rewrites of tasks it already has.
   */
  @Post('tasks/generate')
  @HttpCode(200)
  async generateTasks(@Body() dto: GenerateTasksDto) {
    const avoid = dto.avoid ?? (await this.templates.existingSlugs());
    const outcome = await this.taskGenerator.generate({ ...dto, avoid });
    const filed = await this.templates.fileBatch(outcome);

    return {
      charterHash: outcome.charterHash,
      model: outcome.model,
      usage: outcome.usage,
      saved: filed.saved,
      skipped: filed.skipped,
      rejected: outcome.rejected,
      rejectionsStored: filed.rejectionsStored,
    };
  }

  /** The pool. Filter by status to get the review queue or the live set. */
  @Get('tasks')
  async templateList(@Query() query: ListTemplatesQueryDto) {
    return { templates: await this.templates.list(query) };
  }

  /**
   * Approves a draft into the pool.
   *
   * Re-screened here rather than trusted from generation time — a template can
   * be edited in between, and the Charter can move.
   */
  @Post('tasks/:id/approve')
  @HttpCode(200)
  approveTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.templates.approve(id, user);
  }

  /** Retired, never deleted — a handed-in attempt keeps its meaning. */
  @Post('tasks/:id/retire')
  @HttpCode(200)
  retireTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.templates.retire(id);
  }

  /**
   * How the Charter in force is actually doing.
   *
   * A rule that never fires is either unnecessary or broken; a rule that fires
   * on most generations means the Charter is not carrying it. Both are
   * decisions, and neither is visible without this.
   */
  @Get('tasks/charter-stats')
  charterStats() {
    return this.templates.stats(CHARTER_HASH);
  }

  @Post('attempts/:id/unpublish')
  @HttpCode(200)
  unpublish(@Param('id', ParseUUIDPipe) id: string) {
    return this.gameAdminService.unpublish(id);
  }
}
