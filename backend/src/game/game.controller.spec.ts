import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'http';
import { AuthService } from '../auth/auth.service';
import { TokenService } from '../auth/token.service';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { AssignmentsService } from './assignments.service';
import { AttemptsService } from './attempts.service';
import { ClansController } from './clans.controller';
import { ClansService } from './clans.service';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { VotingController } from './voting.controller';
import { VotingService } from './voting.service';
import { EnrolmentsService } from './enrolments.service';
import { FeedService } from './feed.service';
import { GameController } from './game.controller';
import { LeaderboardService } from './leaderboard.service';
import { SeasonsService } from './seasons.service';
import { TaskTemplatesService } from './task-templates.service';

/** `YYYY-MM-DD`, `years` ago today. Relative so the tests never age out. */
function bornYearsAgo(years: number): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
}

/**
 * The HTTP surface, exercised for real.
 *
 * The service specs prove the rules; this proves the wiring — that the routes
 * are where the game app will look for them, that the global `ValidationPipe`
 * actually rejects a bad body before a service sees it, and that the split
 * between "readable signed out" and "needs a session" is the one the design
 * asks for.
 *
 * The auth guard is stood in for rather than mocked away: it reads the same
 * `@Public()` metadata the real one does, so a route that forgets the decorator
 * fails here.
 */

const services = {
  seasons: { current: jest.fn() },
  enrolments: {
    enrol: jest.fn(),
    chooseRole: jest.fn(),
    mine: jest.fn(),
    rememberedRole: jest.fn(),
  },
  attempts: {
    requestUpload: jest.fn(),
    confirmUpload: jest.fn(),
    mine: jest.fn(),
    handedInToday: jest.fn(),
  },
  assignments: {
    draw: jest.fn(),
    drawForClan: jest.fn(),
    current: jest.fn(),
    accept: jest.fn(),
    decline: jest.fn(),
  },
  shop: { list: jest.fn(), buy: jest.fn(), mine: jest.fn() },
  voting: { open: jest.fn(), vote: jest.fn() },
  clans: {
    create: jest.fn(),
    join: jest.fn(),
    mine: jest.fn(),
    leave: jest.fn(),
  },
  feed: {
    list: jest.fn(),
    getOne: jest.fn(),
    toggleLike: jest.fn(),
    recordShare: jest.fn(),
    listComments: jest.fn(),
    addComment: jest.fn(),
    removeComment: jest.fn(),
  },
  leaderboard: {
    board: jest.fn(),
    searchPlayers: jest.fn(),
    rankOf: jest.fn(),
    standing: jest.fn(),
  },
  templates: { playable: jest.fn() },
  /**
   * The game's sign-up creates an ordinary shop account and hands back the
   * shop's session, so the controller depends on the shop's auth. Faked here
   * because this file is about the HTTP surface; `auth.service.spec.ts` and
   * `token.service.spec.ts` are where those are proven.
   */
  auth: { register: jest.fn() },
  tokens: { issueTokenPair: jest.fn() },
};

/** Cookie attributes come from config; none of them is set in a test. */
const config = { get: () => undefined };

/** Signed out unless a test says otherwise. */
let signedIn: { id: string; username: string; role: string } | null = null;

interface GuardContext {
  getHandler: () => object;
  getClass: () => object;
  switchToHttp: () => { getRequest: () => Record<string, unknown> };
}

/**
 * Built by a factory rather than `useClass`: a plain class with no decorator
 * emits no `design:paramtypes`, so Nest has nothing to inject `Reflector` from
 * and every request 500s on an undefined reflector.
 */
function stubAuthGuard(reflector: Reflector) {
  return {
    canActivate(context: GuardContext): boolean {
      const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      const req = context.switchToHttp().getRequest();
      if (signedIn) req.user = signedIn;
      if (isPublic) return true;
      return Boolean(signedIn);
    },
  };
}

describe('GameController (HTTP)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        GameController,
        ClansController,
        ShopController,
        VotingController,
      ],
      providers: [
        { provide: SeasonsService, useValue: services.seasons },
        { provide: EnrolmentsService, useValue: services.enrolments },
        { provide: AttemptsService, useValue: services.attempts },
        { provide: AssignmentsService, useValue: services.assignments },
        { provide: ClansService, useValue: services.clans },
        { provide: ShopService, useValue: services.shop },
        { provide: VotingService, useValue: services.voting },
        { provide: FeedService, useValue: services.feed },
        { provide: LeaderboardService, useValue: services.leaderboard },
        { provide: TaskTemplatesService, useValue: services.templates },
        { provide: AuthService, useValue: services.auth },
        { provide: TokenService, useValue: services.tokens },
        { provide: ConfigService, useValue: config },
        {
          provide: APP_GUARD,
          useFactory: stubAuthGuard,
          inject: [Reflector],
        },
      ],
    }).compile();

    app = module.createNestApplication();
    // The same pipe main.ts installs, so validation here is the real thing.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.setGlobalPrefix('api');
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    signedIn = null;
    jest.clearAllMocks();
    services.seasons.current.mockResolvedValue({
      id: 's1',
      slug: 'season-zero',
      title: 'Season Zero',
      status: 'open',
      startsAt: null,
      endsAt: null,
    });
    services.feed.list.mockResolvedValue({ items: [], nextCursor: null });
    services.leaderboard.board.mockResolvedValue({
      rows: [],
      total: 0,
      page: 1,
    });
    services.leaderboard.searchPlayers.mockResolvedValue([]);
    services.leaderboard.rankOf.mockResolvedValue(null);
    services.leaderboard.standing.mockResolvedValue({ onBoard: true, rank: 1 });
    services.feed.listComments.mockResolvedValue([]);
    services.templates.playable.mockResolvedValue([]);
    services.attempts.handedInToday.mockResolvedValue(0);
    services.clans.mine.mockResolvedValue(null);
  });

  describe('readable without an account', () => {
    it('answers health', async () => {
      const res = await request(server).get('/api/game/health').expect(200);
      // There is no live streaming, and the front door is told so explicitly.
      expect(res.body).toEqual({ status: 'ok', live: false });
    });

    /** The rules a client states up front come from the same constants. */
    it('states the rules', async () => {
      const res = await request(server).get('/api/game/rules').expect(200);
      expect(res.body).toEqual({
        minimumAge: 16,
        dailyMinimumTasks: 4,
        startingHearts: 3,
        heartCosts: expect.arrayContaining([expect.any(String)]) as string[],
        clanSize: 2,
        // The board ranks and never cuts; the tie-break is stated up front.
        eliminationByRank: false,
        tieBreak: expect.any(String) as string,
        teamPenaltyCoins: { min: 1, max: 3 },
        voting: {
          windowHours: 3,
          rewardCoins: { min: 2, max: 5 },
          cooldownHours: 5,
        },
      });
      const sent = res.body as { heartCosts: string[] };
      expect(sent.heartCosts).toHaveLength(2);
    });

    it('serves the task pool signed out', async () => {
      services.templates.playable.mockResolvedValue([{ id: 't1' }]);
      const res = await request(server)
        .get('/api/game/tasks?tier=2')
        .expect(200);
      expect(res.body).toEqual({ tasks: [{ id: 't1' }] });
      expect(services.templates.playable).toHaveBeenCalledWith({ tier: 2 });
    });

    it('refuses a task tier off the ladder', async () => {
      await request(server).get('/api/game/tasks?tier=4').expect(400);
    });

    it('serves the season', async () => {
      const res = await request(server).get('/api/game/season').expect(200);
      const body = res.body as { season: { slug: string } };
      expect(body.season.slug).toBe('season-zero');
    });

    it('serves the feed signed out', async () => {
      await request(server).get('/api/game/feed').expect(200);
      expect(services.feed.list).toHaveBeenCalledWith(null, {});
    });

    it('serves the leaderboard signed out', async () => {
      await request(server).get('/api/game/leaderboard').expect(200);
    });

    /** A standing is about the person asking, so it needs one. */
    it('keeps a standing behind a session', async () => {
      await request(server).get('/api/game/leaderboard/me').expect(403);
      expect(services.leaderboard.standing).not.toHaveBeenCalled();
    });

    it('answers a signed-in standing', async () => {
      signedIn = { id: 'u1', username: 'kate', role: 'user' };
      services.leaderboard.standing.mockResolvedValue({
        onBoard: true,
        rank: 12,
        cut: 3,
      });
      const res = await request(server)
        .get('/api/game/leaderboard/me')
        .expect(200);
      expect(res.body).toEqual({ onBoard: true, rank: 12, cut: 3 });
      expect(services.leaderboard.standing).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1' }),
      );
    });

    it('serves player search signed out', async () => {
      await request(server).get('/api/game/players/search?q=ast').expect(200);
      expect(services.leaderboard.searchPlayers).toHaveBeenCalledWith('ast');
    });

    it('serves a comment thread signed out', async () => {
      await request(server)
        .get('/api/game/feed/11111111-1111-4111-8111-111111111111/comments')
        .expect(200);
    });

    /** Sharing works signed out, or the share is simply lost. */
    it('accepts a share signed out', async () => {
      services.feed.recordShare.mockResolvedValue({ shareCount: 1 });
      await request(server)
        .post('/api/game/feed/11111111-1111-4111-8111-111111111111/share')
        .expect(200);
    });
  });

  describe('needs a session', () => {
    const routes: [string, 'post' | 'get' | 'delete', string][] = [
      ['enrol', 'post', '/api/game/enrolments'],
      ['read my enrolment', 'get', '/api/game/enrolments/me'],
      ['ask for an upload URL', 'post', '/api/game/attempts/upload-url'],
      ['list my attempts', 'get', '/api/game/attempts/mine'],
      ['draw a task', 'post', '/api/game/tasks/draw'],
      ['read my current task', 'get', '/api/game/assignments/current'],
      [
        'accept a task',
        'post',
        '/api/game/assignments/11111111-1111-4111-8111-111111111111/accept',
      ],
      [
        'decline a task',
        'post',
        '/api/game/assignments/11111111-1111-4111-8111-111111111111/decline',
      ],
      ['create a clan', 'post', '/api/game/clans'],
      ['join a clan', 'post', '/api/game/clans/join'],
      ['read my clan', 'get', '/api/game/clans/mine'],
      ['leave a clan', 'post', '/api/game/clans/leave'],
      ['draw a clan task', 'post', '/api/game/clans/tasks/draw'],
      [
        'buy from the shop',
        'post',
        '/api/game/shop/11111111-1111-4111-8111-111111111111/buy',
      ],
      ['read my purchases', 'get', '/api/game/shop/purchases/mine'],
      ['read the open votes', 'get', '/api/game/votes/open'],
      ['vote', 'post', '/api/game/votes/11111111-1111-4111-8111-111111111111'],
      [
        'like',
        'post',
        '/api/game/feed/11111111-1111-4111-8111-111111111111/like',
      ],
      [
        'comment',
        'post',
        '/api/game/feed/11111111-1111-4111-8111-111111111111/comments',
      ],
    ];

    it.each(routes)('refuses to %s signed out', async (_label, verb, path) => {
      await request(server)[verb](path).expect(403);
    });
  });

  describe('validation runs before the service does', () => {
    beforeEach(() => {
      signedIn = { id: 'u1', username: 'asterisk', role: 'user' };
    });

    it('refuses a role that is not one of the two', async () => {
      await request(server)
        .post('/api/game/enrolments')
        .send({ role: 'referee' })
        .expect(400);
      expect(services.enrolments.chooseRole).not.toHaveBeenCalled();
    });

    it('accepts both real roles', async () => {
      services.enrolments.chooseRole.mockResolvedValue({ role: 'watcher' });
      await request(server)
        .post('/api/game/enrolments')
        .send({ role: 'watcher' })
        .expect(201);
      await request(server)
        .post('/api/game/enrolments')
        .send({ role: 'player' })
        .expect(201);
    });

    const ASSIGNMENT = '22222222-2222-4222-8222-222222222222';

    /**
     * Every hand-in is against an accepted task. A body that names a day but
     * no assignment is the old shape, and it is refused before the service.
     */
    it('demands the assignment the upload is for', async () => {
      await request(server)
        .post('/api/game/attempts/upload-url')
        .send({ day: 1, kind: 'video', mimeType: 'video/mp4', byteSize: 100 })
        .expect(400);
      await request(server)
        .post('/api/game/attempts/upload-url')
        .send({
          assignmentId: 'not-a-uuid',
          kind: 'video',
          mimeType: 'video/mp4',
          byteSize: 100,
        })
        .expect(400);
      expect(services.attempts.requestUpload).not.toHaveBeenCalled();
    });

    /** Live streaming is off — there is no third kind to send. */
    it('refuses a kind that is not photo or video', async () => {
      await request(server)
        .post('/api/game/attempts/upload-url')
        .send({
          assignmentId: ASSIGNMENT,
          kind: 'stream',
          mimeType: 'video/mp4',
          byteSize: 100,
        })
        .expect(400);
    });

    it('refuses a container we do not serve', async () => {
      await request(server)
        .post('/api/game/attempts/upload-url')
        .send({
          assignmentId: ASSIGNMENT,
          kind: 'video',
          mimeType: 'video/x-msvideo',
          byteSize: 100,
        })
        .expect(400);
    });

    it('lets a well-formed upload request through to the service', async () => {
      services.attempts.requestUpload.mockResolvedValue({
        attemptId: 'a1',
        uploadUrl: 'https://storage/put',
        contentType: 'video/mp4',
        expiresAt: '2026-09-06T12:15:00.000Z',
      });
      const res = await request(server)
        .post('/api/game/attempts/upload-url')
        .send({
          assignmentId: ASSIGNMENT,
          kind: 'video',
          mimeType: 'video/mp4',
          byteSize: 6_000_000,
          durationSeconds: 42,
        })
        .expect(201);
      const body = res.body as { uploadUrl: string };
      expect(body.uploadUrl).toBe('https://storage/put');
      expect(services.attempts.requestUpload).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1' }),
        expect.objectContaining({
          assignmentId: ASSIGNMENT,
          durationSeconds: 42,
        }),
      );
    });

    /** The old shape named the day; it is dropped, not honoured. */
    it('strips a day the client tries to send with an upload', async () => {
      services.attempts.requestUpload.mockResolvedValue({ attemptId: 'a1' });
      await request(server)
        .post('/api/game/attempts/upload-url')
        .send({
          assignmentId: ASSIGNMENT,
          day: 3,
          kind: 'photo',
          mimeType: 'image/jpeg',
          byteSize: 100,
        })
        .expect(201);
      expect(services.attempts.requestUpload).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.objectContaining({ day: 3 }),
      );
    });

    it('refuses an empty comment', async () => {
      await request(server)
        .post('/api/game/feed/11111111-1111-4111-8111-111111111111/comments')
        .send({ body: '' })
        .expect(400);
    });

    it('refuses a comment past the length cap', async () => {
      await request(server)
        .post('/api/game/feed/11111111-1111-4111-8111-111111111111/comments')
        .send({ body: 'x'.repeat(501) })
        .expect(400);
    });

    it('refuses a feed id that is not a uuid', async () => {
      await request(server).get('/api/game/feed/not-a-uuid').expect(400);
    });

    /** `whitelist: true` — an unknown field is dropped, not stored. */
    it('strips a field the DTO does not declare', async () => {
      services.enrolments.chooseRole.mockResolvedValue({ role: 'player' });
      await request(server)
        .post('/api/game/enrolments')
        .send({ role: 'player', nerve: 9999 })
        .expect(201);
      expect(services.enrolments.chooseRole).toHaveBeenCalledWith(
        expect.anything(),
        'player',
        undefined,
      );
    });

    /** A shop account was never asked its age; the first side it takes is when. */
    it('passes a date of birth through to the enrolment', async () => {
      services.enrolments.chooseRole.mockResolvedValue({ role: 'player' });
      await request(server)
        .post('/api/game/enrolments')
        .send({ role: 'player', birthDate: '2005-03-04' })
        .expect(201);
      expect(services.enrolments.chooseRole).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1' }),
        'player',
        '2005-03-04',
      );
    });

    it('coerces and clamps feed paging from the query string', async () => {
      await request(server).get('/api/game/feed?limit=5&day=2').expect(200);
      expect(services.feed.list).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1' }),
        { limit: 5, day: 2 },
      );
    });

    it('refuses a feed limit past the cap', async () => {
      await request(server).get('/api/game/feed?limit=500').expect(400);
    });
  });

  /**
   * The task loop: the server draws, the player accepts or declines, the
   * clock is the server's. These hold the routes and their shapes; the rules
   * themselves are in `assignments.service.spec.ts`.
   */
  describe('the task loop', () => {
    const ASSIGNMENT = '22222222-2222-4222-8222-222222222222';
    const view = {
      id: ASSIGNMENT,
      status: 'offered',
      day: 1,
      task: { id: 't1', title: 'Wear it backwards' },
      secondsLeft: null,
    };

    beforeEach(() => {
      signedIn = { id: 'u1', username: 'asterisk', role: 'user' };
      services.assignments.draw.mockResolvedValue(view);
      services.assignments.current.mockResolvedValue(view);
      services.assignments.accept.mockResolvedValue({
        ...view,
        status: 'accepted',
        secondsLeft: 900,
      });
      services.assignments.decline.mockResolvedValue({
        assignment: { ...view, status: 'declined', heartBurned: true },
        heartsRemaining: 2,
        demoted: false,
      });
    });

    it('draws a task for the day', async () => {
      const res = await request(server)
        .post('/api/game/tasks/draw')
        .send({ day: 2 })
        .expect(200);
      expect(res.body).toEqual({ assignment: view });
      expect(services.assignments.draw).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1' }),
        2,
      );
    });

    it('refuses a draw for a day off the ladder', async () => {
      await request(server)
        .post('/api/game/tasks/draw')
        .send({ day: 4 })
        .expect(400);
      await request(server)
        .post('/api/game/tasks/draw')
        .send({ day: 0 })
        .expect(400);
      await request(server).post('/api/game/tasks/draw').send({}).expect(400);
      expect(services.assignments.draw).not.toHaveBeenCalled();
    });

    it('reads the task currently held', async () => {
      const res = await request(server)
        .get('/api/game/assignments/current')
        .expect(200);
      expect(res.body).toEqual({ assignment: view });
    });

    it('is honest when nothing is held', async () => {
      services.assignments.current.mockResolvedValue(null);
      const res = await request(server)
        .get('/api/game/assignments/current')
        .expect(200);
      expect(res.body).toEqual({ assignment: null });
    });

    it('accepts a task and starts the clock', async () => {
      const res = await request(server)
        .post(`/api/game/assignments/${ASSIGNMENT}/accept`)
        .expect(200);
      const sent = res.body as { assignment: { secondsLeft: number } };
      expect(sent.assignment.secondsLeft).toBe(900);
      expect(services.assignments.accept).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1' }),
        ASSIGNMENT,
      );
    });

    it('refuses an assignment id that is not a uuid', async () => {
      await request(server)
        .post('/api/game/assignments/not-a-uuid/accept')
        .expect(400);
      await request(server)
        .post('/api/game/assignments/not-a-uuid/decline')
        .expect(400);
      expect(services.assignments.accept).not.toHaveBeenCalled();
      expect(services.assignments.decline).not.toHaveBeenCalled();
    });

    /** What it cost is in the answer, so the screen can show the heart go. */
    it('declines a task and reports the heart it cost', async () => {
      const res = await request(server)
        .post(`/api/game/assignments/${ASSIGNMENT}/decline`)
        .expect(200);
      expect(res.body).toMatchObject({ heartsRemaining: 2, demoted: false });
      expect(services.assignments.decline).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1' }),
        ASSIGNMENT,
      );
    });
  });

  /**
   * The front door.
   *
   * The page asks one thing at a time — the video, then player or watcher,
   * then a form — and lands the visitor on the dashboard already signed in.
   * That is one request, and these hold what it is allowed to be.
   */
  describe('signing up from the game', () => {
    const body = {
      username: 'asterisk',
      password: 'correct horse',
      role: 'player',
      birthDate: bornYearsAgo(20),
    };

    beforeEach(() => {
      services.auth.register.mockResolvedValue({
        id: 'u9',
        username: 'asterisk',
        email: null,
        role: 'user',
        isVerified: false,
        birthDate: body.birthDate,
      });
      services.enrolments.chooseRole.mockResolvedValue({
        enrolment: { role: 'player' },
        role: 'player',
        pending: null,
      });
      services.tokens.issueTokenPair.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
      });
    });

    /** Nobody has an account yet — that is the point of the page. */
    it('works signed out', async () => {
      await request(server).post('/api/game/register').send(body).expect(201);
    });

    /**
     * A player is an ordinary shop user. If this ever stopped calling the
     * shop's own register there would be two account systems, and the first
     * sign would be a customer who could not sign in on stiff.ge.
     */
    it('creates an ordinary shop account, and never passes the role to it', async () => {
      await request(server).post('/api/game/register').send(body);
      expect(services.auth.register).toHaveBeenCalledWith({
        username: 'asterisk',
        email: null,
        password: 'correct horse',
        birthDate: body.birthDate,
      });
    });

    /** A username, a password, a side, a date of birth. Nothing else. */
    it('needs no email', async () => {
      await request(server).post('/api/game/register').send(body).expect(201);
      expect(services.auth.register).toHaveBeenCalledWith(
        expect.objectContaining({ email: null }),
      );
    });

    it('passes an email through when one is offered', async () => {
      await request(server)
        .post('/api/game/register')
        .send({ ...body, email: 'a@example.com' })
        .expect(201);
      expect(services.auth.register).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'a@example.com' }),
      );
    });

    it('still refuses an email that is not one', async () => {
      await request(server)
        .post('/api/game/register')
        .send({ ...body, email: 'not-an-address' })
        .expect(400);
      expect(services.auth.register).not.toHaveBeenCalled();
    });

    /**
     * The game is 16+ strictly, and the gate is *before* the account exists:
     * refusing afterwards would leave a shop account behind for someone just
     * told they cannot be here.
     */
    describe('the age gate', () => {
      it('refuses an under-sixteen, and makes no account', async () => {
        const res = await request(server)
          .post('/api/game/register')
          .send({ ...body, birthDate: bornYearsAgo(15) })
          .expect(403);
        expect((res.body as { message: string }).message).toMatch(
          /16 or older/,
        );
        expect(services.auth.register).not.toHaveBeenCalled();
        expect(services.enrolments.chooseRole).not.toHaveBeenCalled();
      });

      it('lets someone who turned sixteen today in', async () => {
        await request(server)
          .post('/api/game/register')
          .send({ ...body, birthDate: bornYearsAgo(16) })
          .expect(201);
        expect(services.auth.register).toHaveBeenCalled();
      });

      it('demands a date of birth', async () => {
        const { birthDate: _omitted, ...withoutDate } = body;
        void _omitted;
        await request(server)
          .post('/api/game/register')
          .send(withoutDate)
          .expect(400);
        expect(services.auth.register).not.toHaveBeenCalled();
      });

      it.each(['yesterday', '2010-02-30', '30/02/2010', '2999-01-01'])(
        'refuses %s as a date of birth',
        async (birthDate) => {
          await request(server)
            .post('/api/game/register')
            .send({ ...body, birthDate })
            .expect(400);
          expect(services.auth.register).not.toHaveBeenCalled();
        },
      );

      it('watchers are gated too', async () => {
        await request(server)
          .post('/api/game/register')
          .send({ ...body, role: 'watcher', birthDate: bornYearsAgo(12) })
          .expect(403);
        expect(services.auth.register).not.toHaveBeenCalled();
      });
    });

    it('takes the side and hands back a session', async () => {
      const res = await request(server).post('/api/game/register').send(body);

      expect(services.enrolments.chooseRole).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u9' }),
        'player',
      );
      const sent = res.body as { user: { username: string }; role: string };
      expect(sent.user.username).toBe('asterisk');
      expect(sent.role).toBe('player');
      // The session is a cookie, not only a field, so the game app is signed
      // in on the next request without storing a token itself.
      expect(res.headers['set-cookie']).toBeDefined();
    });

    /** Never the hash, never the settings blob. */
    it('returns a safe user', async () => {
      const res = await request(server).post('/api/game/register').send(body);
      expect(res.body).not.toHaveProperty('user.passwordHash');
      expect(res.body).not.toHaveProperty('user.settings');
    });

    /** Between seasons the account is still made; only the side waits. */
    it('reports a side that was kept rather than joined', async () => {
      services.enrolments.chooseRole.mockResolvedValue({
        enrolment: null,
        role: 'watcher',
        pending: 'no_season',
      });

      const res = await request(server)
        .post('/api/game/register')
        .send({ ...body, role: 'watcher' })
        .expect(201);

      const sent = res.body as { pending: string; enrolment: null };
      expect(sent.pending).toBe('no_season');
      expect(sent.enrolment).toBeNull();
    });

    it('refuses a role that is not one of the two', async () => {
      await request(server)
        .post('/api/game/register')
        .send({ ...body, role: 'referee' })
        .expect(400);
      expect(services.auth.register).not.toHaveBeenCalled();
    });

    /**
     * The same username and password rules as the shop's `RegisterDto`, so an
     * account cannot be made here under looser rules than on stiff.ge.
     */
    it('applies the shop password and username rules', async () => {
      await request(server)
        .post('/api/game/register')
        .send({ ...body, password: 'short' })
        .expect(400);
      await request(server)
        .post('/api/game/register')
        .send({ ...body, username: 'no spaces allowed' })
        .expect(400);
      expect(services.auth.register).not.toHaveBeenCalled();
    });
  });

  /**
   * Clans: two players, one leader. The rules are in `clans.service.spec.ts`;
   * these hold the routes, that they need a session, and that the body is
   * validated before the service is asked.
   */
  describe('clans', () => {
    const clanView = {
      id: 'c1',
      name: 'Night Owls',
      status: 'forming',
      size: 2,
      members: [{ enrolmentId: 'e1', handle: 'asterisk', role: 'leader' }],
      inviteCode: 'ABCD2345',
      myRole: 'leader',
    };

    beforeEach(() => {
      signedIn = { id: 'u1', username: 'asterisk', role: 'user' };
      services.clans.create.mockResolvedValue(clanView);
      services.clans.join.mockResolvedValue({ ...clanView, status: 'full' });
      services.clans.mine.mockResolvedValue(clanView);
      services.clans.leave.mockResolvedValue({ left: true, disbanded: true });
      services.assignments.drawForClan.mockResolvedValue({
        id: '33333333-3333-4333-8333-333333333333',
        status: 'offered',
        clanId: 'c1',
      });
    });

    it('creates a clan and hands back the view', async () => {
      const res = await request(server)
        .post('/api/game/clans')
        .send({ name: 'Night Owls' })
        .expect(201);
      expect(res.body).toEqual({ clan: clanView });
      expect(services.clans.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1' }),
        'Night Owls',
      );
    });

    it('refuses a clan name that is too short before the service sees it', async () => {
      await request(server)
        .post('/api/game/clans')
        .send({ name: 'ab' })
        .expect(400);
      await request(server).post('/api/game/clans').send({}).expect(400);
      expect(services.clans.create).not.toHaveBeenCalled();
    });

    it('joins by code', async () => {
      const res = await request(server)
        .post('/api/game/clans/join')
        .send({ code: 'ABCD2345' })
        .expect(200);
      const sent = res.body as { clan: { status: string } };
      expect(sent.clan.status).toBe('full');
      expect(services.clans.join).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1' }),
        'ABCD2345',
      );
    });

    it('refuses a join with no code', async () => {
      await request(server).post('/api/game/clans/join').send({}).expect(400);
      await request(server)
        .post('/api/game/clans/join')
        .send({ code: 'ab' })
        .expect(400);
      expect(services.clans.join).not.toHaveBeenCalled();
    });

    it('reads my clan', async () => {
      const res = await request(server).get('/api/game/clans/mine').expect(200);
      expect(res.body).toEqual({ clan: clanView });
    });

    it('reads null when I am in no clan', async () => {
      services.clans.mine.mockResolvedValue(null);
      const res = await request(server).get('/api/game/clans/mine').expect(200);
      expect(res.body).toEqual({ clan: null });
    });

    it('leaves and reports whether that disbanded it', async () => {
      const res = await request(server)
        .post('/api/game/clans/leave')
        .expect(200);
      expect(res.body).toEqual({ left: true, disbanded: true });
      expect(services.clans.leave).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1' }),
      );
    });

    it('draws a team task for the day', async () => {
      const res = await request(server)
        .post('/api/game/clans/tasks/draw')
        .send({ day: 3 })
        .expect(200);
      const sent = res.body as { assignment: { clanId: string } };
      expect(sent.assignment.clanId).toBe('c1');
      expect(services.assignments.drawForClan).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1' }),
        3,
      );
    });

    it('refuses a clan draw for a day off the ladder', async () => {
      await request(server)
        .post('/api/game/clans/tasks/draw')
        .send({ day: 4 })
        .expect(400);
      await request(server)
        .post('/api/game/clans/tasks/draw')
        .send({})
        .expect(400);
      expect(services.assignments.drawForClan).not.toHaveBeenCalled();
    });
  });

  /**
   * The coin shop. The list is public — a reason to want an account — and
   * buying needs a session; the controller is a thin door onto `ShopService`.
   */
  describe('the coin shop', () => {
    const item = { id: 'i1', name: 'Cap', priceCoins: 4, bought: 0 };
    const purchase = { id: 'p1', itemId: 'i1', itemName: 'Cap', priceCoins: 4 };

    beforeEach(() => {
      services.shop.list.mockResolvedValue([item]);
      services.shop.buy.mockResolvedValue(purchase);
      services.shop.mine.mockResolvedValue([purchase]);
    });

    it('lists what is on sale signed out, with nothing bought', async () => {
      signedIn = null;
      const res = await request(server).get('/api/game/shop').expect(200);
      expect(res.body).toEqual({ items: [item] });
      expect(services.shop.list).toHaveBeenCalledWith(null);
    });

    it('lists with the reader attached when signed in', async () => {
      signedIn = { id: 'u1', username: 'kate', role: 'user' };
      await request(server).get('/api/game/shop').expect(200);
      expect(services.shop.list).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1' }),
      );
    });

    it('buys with a session and hands back the purchase', async () => {
      signedIn = { id: 'u1', username: 'kate', role: 'user' };
      const res = await request(server)
        .post('/api/game/shop/11111111-1111-4111-8111-111111111111/buy')
        .expect(200);
      expect(res.body).toEqual({ purchase });
      expect(services.shop.buy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1' }),
        '11111111-1111-4111-8111-111111111111',
      );
    });

    it('refuses a buy on something that is not an item id', async () => {
      signedIn = { id: 'u1', username: 'kate', role: 'user' };
      await request(server).post('/api/game/shop/cap/buy').expect(400);
      expect(services.shop.buy).not.toHaveBeenCalled();
    });

    it('lists my purchases', async () => {
      signedIn = { id: 'u1', username: 'kate', role: 'user' };
      const res = await request(server)
        .get('/api/game/shop/purchases/mine')
        .expect(200);
      expect(res.body).toEqual({ purchases: [purchase] });
      expect(services.shop.mine).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1' }),
      );
    });
  });

  /**
   * The watchers' vote. Both routes need a session; the watcher-only rule
   * lives in `VotingService`, so here only the wiring and the body are held.
   */
  describe('the vote', () => {
    const open = [{ id: 'a1', yes: 2, no: 1, myVote: null }];
    const cast = { attemptId: 'a1', vote: 'yes', yes: 3, no: 1 };

    beforeEach(() => {
      signedIn = { id: 'u1', username: 'kate', role: 'user' };
      services.voting.open.mockResolvedValue(open);
      services.voting.vote.mockResolvedValue(cast);
    });

    it('lists what is open for a vote', async () => {
      const res = await request(server).get('/api/game/votes/open').expect(200);
      expect(res.body).toEqual({ items: open });
      expect(services.voting.open).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1' }),
      );
    });

    it('casts a vote and hands back the tally', async () => {
      const res = await request(server)
        .post('/api/game/votes/11111111-1111-4111-8111-111111111111')
        .send({ vote: 'yes' })
        .expect(200);
      expect(res.body).toEqual(cast);
      expect(services.voting.vote).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1' }),
        '11111111-1111-4111-8111-111111111111',
        'yes',
      );
    });

    it.each(['maybe', '', undefined])(
      'refuses a vote of %p before the service sees it',
      async (vote) => {
        await request(server)
          .post('/api/game/votes/11111111-1111-4111-8111-111111111111')
          .send(vote === undefined ? {} : { vote })
          .expect(400);
        expect(services.voting.vote).not.toHaveBeenCalled();
      },
    );

    it('refuses a vote on something that is not an attempt id', async () => {
      await request(server)
        .post('/api/game/votes/not-an-id')
        .send({ vote: 'no' })
        .expect(400);
      expect(services.voting.vote).not.toHaveBeenCalled();
    });
  });

  describe('the dashboard bootstrap', () => {
    it('needs a session', async () => {
      await request(server).get('/api/game/me').expect(403);
    });

    /** One call, so the screen is never built from a half-arrived state. */
    it('answers user, season, enrolment, today and the kept side together', async () => {
      signedIn = { id: 'u1', username: 'kate', role: 'user' };
      services.enrolments.mine.mockResolvedValue({
        id: 'e1',
        role: 'player',
        nerve: 12,
      });
      services.enrolments.rememberedRole.mockReturnValue(null);
      services.attempts.handedInToday.mockResolvedValue(2);
      services.leaderboard.rankOf.mockResolvedValue(7);

      const res = await request(server).get('/api/game/me').expect(200);

      const sent = res.body as Record<string, unknown>;
      expect(Object.keys(sent).sort()).toEqual([
        'clan',
        'enrolment',
        'rank',
        'rememberedRole',
        'season',
        'today',
        'user',
      ]);
      expect(sent.season).toMatchObject({ slug: 'season-zero' });
      // "2 of 4", shown early so nobody finds out at midnight.
      expect(sent.today).toEqual({ handedIn: 2, minimum: 4 });
      expect(services.attempts.handedInToday).toHaveBeenCalledWith('e1');
      // Their place on the board rides along, by the board's own rule.
      expect(sent.rank).toBe(7);
      expect(services.leaderboard.rankOf).toHaveBeenCalledWith('e1');
    });

    /** A watcher is not on the board, and the board is not asked. */
    it('has no rank for a watcher', async () => {
      signedIn = { id: 'u1', username: 'kate', role: 'user' };
      services.enrolments.mine.mockResolvedValue({ id: 'e1', role: 'watcher' });
      services.enrolments.rememberedRole.mockReturnValue(null);

      const res = await request(server).get('/api/game/me').expect(200);
      expect((res.body as { rank: unknown }).rank).toBeNull();
      expect(services.leaderboard.rankOf).not.toHaveBeenCalled();
    });

    /** The clan rides along, so the screen knows who the player is with. */
    it('carries the clan for someone enrolled', async () => {
      signedIn = { id: 'u1', username: 'kate', role: 'user' };
      services.enrolments.mine.mockResolvedValue({ id: 'e1', role: 'player' });
      services.enrolments.rememberedRole.mockReturnValue(null);
      services.clans.mine.mockResolvedValue({ id: 'c1', name: 'Night Owls' });

      const res = await request(server).get('/api/game/me').expect(200);

      expect((res.body as { clan: unknown }).clan).toEqual({
        id: 'c1',
        name: 'Night Owls',
      });
      expect(services.clans.mine).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1' }),
      );
    });

    it('has no clan for someone not enrolled, and does not ask', async () => {
      signedIn = { id: 'u1', username: 'kate', role: 'user' };
      services.enrolments.mine.mockResolvedValue(null);
      services.enrolments.rememberedRole.mockReturnValue(null);

      const res = await request(server).get('/api/game/me').expect(200);
      expect((res.body as { clan: unknown }).clan).toBeNull();
      expect(services.clans.mine).not.toHaveBeenCalled();
    });

    /** A watcher has no daily minimum, so there is nothing to count. */
    it('has no today for a watcher', async () => {
      signedIn = { id: 'u1', username: 'kate', role: 'user' };
      services.enrolments.mine.mockResolvedValue({ id: 'e1', role: 'watcher' });
      services.enrolments.rememberedRole.mockReturnValue(null);

      const res = await request(server).get('/api/game/me').expect(200);

      expect((res.body as { today: unknown }).today).toBeNull();
      expect(services.attempts.handedInToday).not.toHaveBeenCalled();
    });

    it('has no today for someone not enrolled', async () => {
      signedIn = { id: 'u1', username: 'kate', role: 'user' };
      services.enrolments.mine.mockResolvedValue(null);
      services.enrolments.rememberedRole.mockReturnValue(null);

      const res = await request(server).get('/api/game/me').expect(200);
      expect((res.body as { today: unknown }).today).toBeNull();
    });

    it('says so plainly between seasons', async () => {
      signedIn = { id: 'u1', username: 'kate', role: 'user' };
      services.seasons.current.mockResolvedValue(null);
      services.enrolments.mine.mockResolvedValue(null);
      services.enrolments.rememberedRole.mockReturnValue('player');

      const res = await request(server).get('/api/game/me').expect(200);

      const sent = res.body as { season: null; rememberedRole: string };
      expect(sent.season).toBeNull();
      expect(sent.rememberedRole).toBe('player');
    });
  });
});
