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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../users/user.entity';
import {
  AdjustCoinsDto,
  CoinLedgerQueryDto,
  ListAttemptsQueryDto,
  ListClocksQueryDto,
  ListVotesQueryDto,
  OrganizeWarDto,
  SetHiddenDto,
} from './dto/game.dto';
import { EconomyService } from './economy.service';
import { OperationsService } from './operations.service';
import { WarsService } from './wars.service';

/**
 * `/api/game/admin/*` — the control room's remaining views and levers.
 *
 * `@Roles('admin')` at the class level, which is also what lets an
 * admin.stiff.co session reach these at all. Every write here is recorded in
 * `admin_audit_logs` by the interceptor, like every other admin write; the
 * coin correction and the organised war are the two that most deserve it.
 *
 * Nothing here lets an admin bet. An operator who can see every pool and
 * settle every war has no business holding a stake in one.
 */
@Controller('game/admin')
@Roles('admin')
export class OperationsController {
  constructor(
    private readonly operations: OperationsService,
    private readonly economy: EconomyService,
    private readonly wars: WarsService,
  ) {}

  // ------------------------------------------------------------------ clans

  @Get('clans')
  async clans() {
    return { clans: await this.operations.clans() };
  }

  /** Sets two clans a war, skipping the challenge. The book opens now. */
  @Post('wars')
  async organizeWar(@Body() dto: OrganizeWarDto) {
    return { war: await this.wars.organize(dto) };
  }

  // ------------------------------------------------------------------ coins

  /** Every coin this enrolment gained or lost, newest first. */
  @Get('enrolments/:id/coin-ledger')
  async coinLedger(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CoinLedgerQueryDto,
  ) {
    return { ledger: await this.economy.ledger(id, query.limit) };
  }

  /**
   * A correction to a player's coins. Floors at zero, writes an `admin`
   * ledger row naming the admin, and reports what actually moved — a
   * 50-coin deduction from a 20-coin balance moves 20.
   */
  @Post('enrolments/:id/coins')
  @HttpCode(200)
  async adjustCoins(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustCoinsDto,
    @CurrentUser() admin: User,
  ) {
    const [moved] = await this.economy.move([id], {
      coins: dto.delta,
      reason: 'admin',
      refType: 'admin',
      refId: admin.id,
      by: admin.id,
    });
    if (!moved) throw new NotFoundException('Enrolment not found');
    return {
      enrolmentId: moved.enrolmentId,
      coinsDelta: moved.coinsDelta,
      coins: moved.coinsAfter,
      reason: dto.reason.trim(),
    };
  }

  // --------------------------------------------------------------- hand-ins

  /** Every hand-in in the season, filterable. The review queue is a subset. */
  @Get('attempts')
  attempts(@Query() query: ListAttemptsQueryDto) {
    return this.operations.attempts(query);
  }

  /** All comments on one hand-in, hidden ones included. */
  @Get('attempts/:id/comments')
  async comments(@Param('id', ParseUUIDPipe) id: string) {
    return { comments: await this.operations.comments(id) };
  }

  /** Hide or restore a comment. Reversible, unlike deleting it. */
  @Patch('comments/:id')
  async setCommentHidden(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetHiddenDto,
  ) {
    return { comment: await this.operations.setCommentHidden(id, dto.hidden) };
  }

  // ---------------------------------------------------------- votes, clocks

  @Get('votes')
  async votes(@Query() query: ListVotesQueryDto) {
    return { votes: await this.operations.votes(query.status) };
  }

  @Get('clocks')
  async clocks(@Query() query: ListClocksQueryDto) {
    return { clocks: await this.operations.clocks(query.status) };
  }
}
