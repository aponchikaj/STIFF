import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import {
  AdjustScoreDto,
  CreateSeasonDto,
  CreateShopItemDto,
  FlagCheaterDto,
  ListPurchasesQueryDto,
  ListShopItemsQueryDto,
  SetPurchaseStatusDto,
  UpdateShopItemDto,
  GenerateTasksDto,
  ListEnrolmentsQueryDto,
  ListTemplatesQueryDto,
  ReinstateDto,
  ReviewQueueQueryDto,
  ScoreLedgerQueryDto,
  SetSeasonStatusDto,
  SettleAttemptDto,
} from './dto/game.dto';
import { GameAdminService } from './game-admin.service';
import { TaskPipelineService } from './ai/task-pipeline.service';
import { TaskReviewerService } from './ai/task-reviewer.service';
import { TaskTemplatesService } from './task-templates.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { CHARTER_HASH } from './ai/charter';
import { DisciplineService } from './discipline.service';
import { EconomyService } from './economy.service';
import { ShopService } from './shop.service';
import { VotingService } from './voting.service';

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
    private readonly pipeline: TaskPipelineService,
    private readonly reviewer: TaskReviewerService,
    private readonly templates: TaskTemplatesService,
    private readonly discipline: DisciplineService,
    private readonly economy: EconomyService,
    private readonly shop: ShopService,
    private readonly voting: VotingService,
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

  /** What is waiting for a verdict. Oldest first, with what the model thought. */
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
    @CurrentUser() admin: User,
  ) {
    return this.gameAdminService.settle(id, { ...dto, by: admin.id });
  }

  /** Out of the feed, and its Nerve back off the board through the ledger. */
  @Post('attempts/:id/unpublish')
  @HttpCode(200)
  unpublish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: User,
  ) {
    return this.gameAdminService.unpublish(id, { by: admin.id });
  }

  // ---------------------------------------------------------- discipline --

  /** Who is in the season, filterable by side and standing. */
  @Get('enrolments')
  async enrolments(@Query() query: ListEnrolmentsQueryDto) {
    return { enrolments: await this.gameAdminService.listEnrolments(query) };
  }

  /**
   * A person calling it, with the same consequence as the model: zero
   * everything, watcher, marked. `attemptId`, if given, is rejected too.
   */
  @Post('enrolments/:id/flag-cheater')
  @HttpCode(200)
  flagCheater(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FlagCheaterDto,
    @CurrentUser() admin: User,
  ) {
    return this.discipline.flagCheater(id, {
      attemptId: dto.attemptId,
      reason: dto.reason,
      by: admin.id,
    });
  }

  /** The one way back to player. Restores the zeroed score unless told not to. */
  @Post('enrolments/:id/reinstate')
  @HttpCode(200)
  reinstate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReinstateDto,
    @CurrentUser() admin: User,
  ) {
    return this.discipline.reinstate(id, {
      restore: dto.restore,
      by: admin.id,
    });
  }

  // --------------------------------------------------------------- score --

  /** Every point of Nerve this enrolment ever gained or lost, newest first. */
  @Get('enrolments/:id/score-ledger')
  async scoreLedger(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ScoreLedgerQueryDto,
  ) {
    return { ledger: await this.economy.scoreLedger(id, query.limit) };
  }

  /**
   * A correction to one player's score, on the record.
   *
   * Goes through the same movement everything else does, so it floors at
   * zero, writes its own ledger row with the admin's id and reason, and
   * moves `lastScoredAt` only when the score went up. The audit trail has
   * the request; the ledger has the consequence.
   */
  @Post('enrolments/:id/score')
  @HttpCode(200)
  async adjustScore(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustScoreDto,
    @CurrentUser() admin: User,
  ) {
    const [moved] = await this.economy.move([id], {
      coins: 0,
      nerve: dto.delta,
      reason: 'admin',
      refType: 'admin',
      refId: admin.id,
      by: admin.id,
    });
    if (!moved) throw new NotFoundException('Enrolment not found');
    return {
      enrolmentId: moved.enrolmentId,
      nerveDelta: moved.nerveDelta,
      nerve: moved.nerveAfter,
      reason: dto.reason.trim(),
    };
  }

  /**
   * Runs both nightly sweeps now.
   *
   * The crons are the schedule; this is the button. It exists so the rules
   * can be exercised on a test season without waiting for midnight in
   * Tbilisi, and so an operator can re-run a sweep the instance slept through.
   */
  @Post('discipline/run')
  @HttpCode(200)
  runSweeps() {
    return this.discipline.runSweeps();
  }

  /** Resolves every vote whose window has closed, now. The cron's button. */
  @Post('votes/resolve')
  @HttpCode(200)
  resolveVotes() {
    return this.voting.resolveDue();
  }

  // ---------------------------------------------------------------- shop --

  @Get('shop/items')
  async shopItems(@Query() query: ListShopItemsQueryDto) {
    return { items: await this.shop.listAll(query) };
  }

  @Post('shop/items')
  createShopItem(@Body() dto: CreateShopItemDto, @CurrentUser() admin: User) {
    return this.shop.create(dto, admin);
  }

  @Patch('shop/items/:id')
  updateShopItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShopItemDto,
  ) {
    return this.shop.update(id, dto);
  }

  @Get('shop/purchases')
  async purchases(@Query() query: ListPurchasesQueryDto) {
    return { purchases: await this.shop.purchases(query) };
  }

  /** Handed over, or cancelled with the coins and stock returned. */
  @Patch('shop/purchases/:id')
  setPurchaseStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPurchaseStatusDto,
  ) {
    return this.shop.setPurchaseStatus(id, dto.status, dto.note);
  }

  // --------------------------------------------------------------- tasks --

  /**
   * Two agents write the pool.
   *
   * The creator writes a batch with the Charter and the blocklist in
   * context; every task then passes the regex screen and the reviewer agent,
   * and a refusal from either goes back to the creator with the reason for a
   * different task, up to `GAME_TASK_MAX_ROUNDS` per slot. What survives is
   * filed as drafts, each carrying the review that let it through, and every
   * refusal is kept with which gate refused it and what the creator was told.
   *
   * Nothing here publishes — approval is a separate, human act, and a task
   * the reviewer rejected cannot be approved until it is reviewed again.
   *
   * The existing pool is passed to the creator as `avoid` automatically.
   */
  @Post('tasks/generate')
  @HttpCode(200)
  async generateTasks(@Body() dto: GenerateTasksDto) {
    const avoid = dto.avoid ?? (await this.templates.existingSlugs());
    const outcome = await this.pipeline.run({ ...dto, avoid });
    const filed = await this.templates.fileBatch(outcome);

    return {
      charterHash: outcome.charterHash,
      models: outcome.models,
      usage: outcome.usage,
      rounds: outcome.rounds,
      maxRounds: outcome.maxRounds,
      dropped: outcome.dropped,
      saved: filed.saved,
      skipped: filed.skipped,
      rejected: outcome.rejected,
      rejectionsStored: filed.rejectionsStored,
    };
  }

  /**
   * Runs the reviewer on one stored task — a hand-written one, or a draft
   * edited since the pipeline reviewed it. The verdict is kept on the row.
   */
  @Post('tasks/:id/review')
  @HttpCode(200)
  async reviewTemplate(@Param('id', ParseUUIDPipe) id: string) {
    const row = await this.templates.get(id);
    const verdict = await this.reviewer.review({
      title: row.title,
      brief: row.brief,
      tier: row.tier,
      proof: row.proof ?? 'either',
      guards: row.guards,
      criteria: row.criteria,
    });
    return this.templates.recordReview(id, verdict);
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
}
