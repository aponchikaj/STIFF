import { Controller, Get } from '@nestjs/common';
import { CHART_VERSION, DIFFICULTIES } from '@stiff/game-core';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { toSafeUser, type User } from '../users/user.entity';

@Controller('game')
export class GameController {
  /**
   * What the client needs before it can offer to start anything, and the
   * cheapest way to see whether the shared session actually crossed the
   * subdomain: unauthenticated it returns `player: null`, and a browser
   * carrying a stiff.ge session returns the player.
   *
   * `@Public()` rather than authenticated because game.stiff.ge has a
   * logged-out landing state — anonymous visitors get the demo gate, and a
   * 401 here would be a normal condition rather than an error.
   */
  @Get('session')
  @Public()
  session(@CurrentUser() user?: User) {
    return {
      player: user ? toSafeUser(user) : null,
      chartVersion: CHART_VERSION,
      difficulties: DIFFICULTIES,
    };
  }
}
