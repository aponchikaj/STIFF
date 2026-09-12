import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { AssignmentsService } from './assignments.service';
import { ClansService } from './clans.service';
import { CreateClanDto, DrawTaskDto, JoinClanDto } from './dto/game.dto';

/**
 * `/api/game/clans/*` — two players, one leader, team tasks.
 *
 * Everything here needs a session and a player enrolment. Accepting,
 * declining and handing in a clan task go through the ordinary assignment
 * routes: the assignment is held by the leader, and `AssignmentsService`
 * knows a clan draw from a solo one by its `clanId`.
 */
@Controller('game/clans')
export class ClansController {
  constructor(
    private readonly clans: ClansService,
    private readonly assignments: AssignmentsService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(@CurrentUser() user: User, @Body() dto: CreateClanDto) {
    return { clan: await this.clans.create(user, dto.name) };
  }

  @Post('join')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async join(@CurrentUser() user: User, @Body() dto: JoinClanDto) {
    return { clan: await this.clans.join(user, dto.code) };
  }

  @Get('mine')
  async mine(@CurrentUser() user: User) {
    return { clan: await this.clans.mine(user) };
  }

  /** Only while forming. The leader's leaving disbands it. */
  @Post('leave')
  @HttpCode(200)
  leave(@CurrentUser() user: User) {
    return this.clans.leave(user);
  }

  /** Leader only, full clan only. Draws a team task for the day. */
  @Post('tasks/draw')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async draw(@CurrentUser() user: User, @Body() dto: DrawTaskDto) {
    return {
      assignment: await this.assignments.drawForClan(user, dto.day),
    };
  }
}
