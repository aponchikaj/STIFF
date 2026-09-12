import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { VoteDto } from './dto/game.dto';
import { VotingService } from './voting.service';

/**
 * `/api/game/votes/*` — how a watcher earns.
 *
 * Watchers only, both routes: a player's opinion of another player's
 * hand-in is not evidence, and the coins are the audience's.
 */
@Controller('game/votes')
export class VotingController {
  constructor(private readonly voting: VotingService) {}

  /** Hand-ins whose window is open, with the tallies and my vote. */
  @Get('open')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async open(@CurrentUser() user: User) {
    return { items: await this.voting.open(user) };
  }

  @Post(':attemptId')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  vote(
    @CurrentUser() user: User,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() dto: VoteDto,
  ) {
    return this.voting.vote(user, attemptId, dto.vote);
  }
}
