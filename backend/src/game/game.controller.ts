import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { setAuthCookies } from '../auth/auth-cookies';
import { AuthService } from '../auth/auth.service';
import { TokenService } from '../auth/token.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { toSafeUser, User } from '../users/user.entity';
import { AttemptsService } from './attempts.service';
import {
  AddCommentDto,
  ConfirmAttemptDto,
  EnrolDto,
  FeedQueryDto,
  GameRegisterDto,
  LeaderboardQueryDto,
  PlayerSearchQueryDto,
  RequestUploadDto,
} from './dto/game.dto';
import { EnrolmentsService } from './enrolments.service';
import { FeedService } from './feed.service';
import { LeaderboardService } from './leaderboard.service';
import { SeasonsService } from './seasons.service';

/**
 * `/api/game/*` — the player and watcher API.
 *
 * The reading half is `@Public()` on purpose. A watcher who has not signed in
 * can still scroll the feed, read the board and look a player up, because the
 * feed is the thing that makes someone want an account. Everything that
 * *changes* something needs a session, and everything that hands something in
 * needs a player enrolment on top of that.
 *
 * `@Public()` in this codebase means "works without a user, personalises when
 * there is one" — which is exactly why `likedByMe` is `null` rather than
 * `false` for an anonymous reader. False would be a claim about someone who
 * does not exist.
 */
@Controller('game')
export class GameController {
  constructor(
    private readonly seasonsService: SeasonsService,
    private readonly enrolmentsService: EnrolmentsService,
    private readonly attemptsService: AttemptsService,
    private readonly feedService: FeedService,
    private readonly leaderboardService: LeaderboardService,
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  // ------------------------------------------------------------- the season

  @Public()
  @Get('health')
  health(): { status: 'ok'; live: boolean } {
    // Unauthenticated on purpose: the game origin polls this to know the API
    // is reachable before it asks anyone to sign in.
    return { status: 'ok', live: false };
  }

  @Public()
  @Get('season')
  async season() {
    const season = await this.seasonsService.current();
    if (!season) return { season: null };
    return {
      season: {
        id: season.id,
        slug: season.slug,
        title: season.title,
        status: season.status,
        startsAt: season.startsAt,
        endsAt: season.endsAt,
      },
    };
  }

  // ---------------------------------------------------- the front door

  /**
   * Sign up from the game: a side, then an account, then a session.
   *
   * One request because the page asks one thing at a time — the video, then
   * player or watcher, then a form — and a visitor who has just answered three
   * questions should not then be asked to sign in.
   *
   * It creates an ordinary **shop** account. There is no separate game user:
   * `AuthService.register` is the same call `/api/auth/register` makes, so the
   * duplicate checks, the password rules and the verification mail are the
   * shop's, and the session handed back is the shop's session. Someone who
   * signs up here can buy something afterwards without registering again.
   *
   * The side is taken by `chooseRole`, which is what lets this work between
   * seasons: with nothing to join the account is still made and the choice is
   * kept. `pending` says which of those happened.
   */
  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(
    @Body() dto: GameRegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.register({
      username: dto.username,
      email: dto.email,
      password: dto.password,
    });
    const choice = await this.enrolmentsService.chooseRole(user, dto.role);
    const pair = await this.tokenService.issueTokenPair(user);
    setAuthCookies(res, pair, this.configService);

    return {
      user: toSafeUser(user),
      ...choice,
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
    };
  }

  // ---------------------------------------------------------- enrolment

  /**
   * Takes a side for someone who already has an account — the path for a
   * visitor who arrived from stiff.ge already signed in.
   *
   * Returns the same shape as `register` so the page has one thing to read
   * whichever way the visitor came in.
   */
  @Post('enrolments')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  enrol(@CurrentUser() user: User, @Body() dto: EnrolDto) {
    return this.enrolmentsService.chooseRole(user, dto.role);
  }

  @Get('enrolments/me')
  async mine(@CurrentUser() user: User) {
    return { enrolment: await this.enrolmentsService.mine(user) };
  }

  /**
   * Everything the dashboard renders, in one call.
   *
   * The alternative is three round trips on every load — session, season,
   * enrolment — which on a phone is three chances to show a half-built screen.
   */
  @Get('me')
  async dashboard(@CurrentUser() user: User) {
    const season = await this.seasonsService.current();
    return {
      user: toSafeUser(user),
      season: season
        ? {
            id: season.id,
            slug: season.slug,
            title: season.title,
            status: season.status,
            startsAt: season.startsAt,
            endsAt: season.endsAt,
          }
        : null,
      enrolment: await this.enrolmentsService.mine(user),
      /** The side kept from a choice made before a season existed. */
      rememberedRole: this.enrolmentsService.rememberedRole(user),
    };
  }

  // ------------------------------------------------------- handing in proof

  /**
   * Step one of two. Returns a URL the browser `PUT`s the file to directly —
   * the bytes never come through here.
   */
  @Post('attempts/upload-url')
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  requestUpload(@CurrentUser() user: User, @Body() dto: RequestUploadDto) {
    return this.attemptsService.requestUpload(user, dto);
  }

  /** Step two: the file is in storage, so the row becomes a real attempt. */
  @Post('attempts/:id/confirm')
  @HttpCode(200)
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  confirmUpload(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmAttemptDto,
  ) {
    return this.attemptsService.confirmUpload(user, id, dto);
  }

  @Get('attempts/mine')
  async myAttempts(@CurrentUser() user: User) {
    return { attempts: await this.attemptsService.mine(user) };
  }

  // ------------------------------------------------------------- the feed

  @Public()
  @Get('feed')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  feed(@Req() req: Request, @Query() query: FeedQueryDto) {
    return this.feedService.list(currentUser(req), query);
  }

  @Public()
  @Get('feed/:id')
  feedItem(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.feedService.getOne(currentUser(req), id);
  }

  @Post('feed/:id/like')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  like(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.feedService.toggleLike(user, id);
  }

  /**
   * A tap on share, counted.
   *
   * `@Public()` because the share sheet works signed out — Instagram has no web
   * API for Stories, so the browser composes a card and hands it to the OS, and
   * requiring an account to tap that would only lose the share.
   */
  @Public()
  @Post('feed/:id/share')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  share(@Param('id', ParseUUIDPipe) id: string) {
    return this.feedService.recordShare(id);
  }

  @Public()
  @Get('feed/:id/comments')
  async comments(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return {
      comments: await this.feedService.listComments(currentUser(req), id),
    };
  }

  @Post('feed/:id/comments')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  addComment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.feedService.addComment(user, id, dto.body);
  }

  @Delete('comments/:id')
  async removeComment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.feedService.removeComment(user, id);
    return { success: true };
  }

  // ------------------------------------------------- board and player search

  @Public()
  @Get('leaderboard')
  leaderboard(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardService.board(query);
  }

  /** Players only — a watcher chose the audience and is not a search result. */
  @Public()
  @Get('players/search')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  async searchPlayers(@Query() query: PlayerSearchQueryDto) {
    return { players: await this.leaderboardService.searchPlayers(query.q) };
  }
}

/** `@Public()` routes get the user attached when there is one, or nothing. */
function currentUser(req: Request): User | null {
  return (req as AuthenticatedRequest).user ?? null;
}
