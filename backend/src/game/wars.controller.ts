import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { User } from '../users/user.entity';
import {
  ListWarsQueryDto,
  PlaceBetDto,
  ProposeWarDto,
  VoidWarDto,
} from './dto/game.dto';
import {
  WAR_DURATION_HOURS,
  WAR_MIN_LEAD_MINUTES,
  WAR_MIN_STAKE_COINS,
} from './rules';
import { WarsService } from './wars.service';

/**
 * `/api/game/wars/*` — clan wars and the coin book on them.
 *
 * Reading is `@Public()`: a war is something to watch, and the pools are
 * part of what makes it worth watching. Nothing that identifies a bettor is
 * ever in a public response — only totals and a count. Everything that
 * moves coins needs a session.
 */
@Controller('game/wars')
export class WarsController {
  constructor(private readonly wars: WarsService) {}

  @Public()
  @Get()
  async list(@Req() req: Request, @Query() query: ListWarsQueryDto) {
    return { wars: await this.wars.list(currentUser(req), query.filter) };
  }

  @Public()
  @Get(':id')
  async get(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return { war: await this.wars.get(currentUser(req), id) };
  }

  /** A leader challenges another full clan. */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async propose(@CurrentUser() user: User, @Body() dto: ProposeWarDto) {
    return { war: await this.wars.propose(user, dto) };
  }

  @Post(':id/accept')
  @HttpCode(200)
  async accept(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { war: await this.wars.accept(user, id) };
  }

  @Post(':id/decline')
  @HttpCode(200)
  async decline(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { war: await this.wars.decline(user, id) };
  }

  /** The challenger calls it off before it starts. Refunds any bets. */
  @Post(':id/withdraw')
  @HttpCode(200)
  async withdraw(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { war: await this.wars.withdraw(user, id) };
  }

  /**
   * Coins on a side. Throttled harder than anything else here: a bet is the
   * one action where hammering the endpoint is the point of an attack.
   */
  @Post(':id/bets')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async bet(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlaceBetDto,
  ) {
    return { war: await this.wars.placeBet(user, id, dto) };
  }
}

/** `/api/game/admin/wars/*` — the two levers a person needs on a war. */
@Controller('game/admin/wars')
@Roles('admin')
export class WarsAdminController {
  constructor(private readonly wars: WarsService) {}

  @Get()
  async list(@CurrentUser() user: User, @Query() query: ListWarsQueryDto) {
    return {
      wars: await this.wars.list(null, query.filter),
      rules: {
        durationHours: WAR_DURATION_HOURS,
        minLeadMinutes: WAR_MIN_LEAD_MINUTES,
        minStake: WAR_MIN_STAKE_COINS,
      },
    };
  }

  /**
   * Settles on what has been judged, now. For a war stuck in `judging` on a
   * clip nobody is going to review.
   */
  @Post(':id/settle')
  @HttpCode(200)
  async settle(@Param('id', ParseUUIDPipe) id: string) {
    return { war: await this.wars.settle(id, { force: true }) };
  }

  /** Calls it off and refunds every stake. Say why; the bettors are told. */
  @Post(':id/void')
  @HttpCode(200)
  async void(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VoidWarDto) {
    return { war: await this.wars.voidWar(id, dto.reason) };
  }

  /** Runs the clock now, for a test season or an instance that slept. */
  @Post('tick')
  @HttpCode(200)
  tick() {
    return this.wars.tick();
  }
}

function currentUser(req: Request): User | null {
  return (req as AuthenticatedRequest).user ?? null;
}
