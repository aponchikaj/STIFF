import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'http';
import { AuthService } from '../auth/auth.service';
import { TokenService } from '../auth/token.service';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { AttemptsService } from './attempts.service';
import { EnrolmentsService } from './enrolments.service';
import { FeedService } from './feed.service';
import { GameController } from './game.controller';
import { LeaderboardService } from './leaderboard.service';
import { SeasonsService } from './seasons.service';

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
  leaderboard: { board: jest.fn(), searchPlayers: jest.fn() },
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
      controllers: [GameController],
      providers: [
        { provide: SeasonsService, useValue: services.seasons },
        { provide: EnrolmentsService, useValue: services.enrolments },
        { provide: AttemptsService, useValue: services.attempts },
        { provide: FeedService, useValue: services.feed },
        { provide: LeaderboardService, useValue: services.leaderboard },
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
    services.feed.listComments.mockResolvedValue([]);
  });

  describe('readable without an account', () => {
    it('answers health', async () => {
      const res = await request(server).get('/api/game/health').expect(200);
      // There is no live streaming, and the front door is told so explicitly.
      expect(res.body).toEqual({ status: 'ok', live: false });
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

    it('refuses a day off the ladder', async () => {
      await request(server)
        .post('/api/game/attempts/upload-url')
        .send({ day: 4, kind: 'video', mimeType: 'video/mp4', byteSize: 100 })
        .expect(400);
      expect(services.attempts.requestUpload).not.toHaveBeenCalled();
    });

    /** Live streaming is off — there is no third kind to send. */
    it('refuses a kind that is not photo or video', async () => {
      await request(server)
        .post('/api/game/attempts/upload-url')
        .send({ day: 1, kind: 'stream', mimeType: 'video/mp4', byteSize: 100 })
        .expect(400);
    });

    it('refuses a container we do not serve', async () => {
      await request(server)
        .post('/api/game/attempts/upload-url')
        .send({
          day: 1,
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
          day: 2,
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
        expect.objectContaining({ day: 2, durationSeconds: 42 }),
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
   * The front door.
   *
   * The page asks one thing at a time — the video, then player or watcher,
   * then a form — and lands the visitor on the dashboard already signed in.
   * That is one request, and these hold what it is allowed to be.
   */
  describe('signing up from the game', () => {
    const body = {
      username: 'asterisk',
      email: 'a@example.com',
      password: 'correct horse',
      role: 'player',
    };

    beforeEach(() => {
      services.auth.register.mockResolvedValue({
        id: 'u9',
        username: 'asterisk',
        email: 'a@example.com',
        role: 'user',
        isVerified: false,
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
        email: 'a@example.com',
        password: 'correct horse',
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
     * Inherited from the shop's `RegisterDto`. The point of extending it is
     * that an account cannot be made here under looser rules than on stiff.ge.
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

  describe('the dashboard bootstrap', () => {
    it('needs a session', async () => {
      await request(server).get('/api/game/me').expect(403);
    });

    /** One call, so the screen is never built from a half-arrived state. */
    it('answers user, season, enrolment and the kept side together', async () => {
      signedIn = { id: 'u1', username: 'kate', role: 'user' };
      services.enrolments.mine.mockResolvedValue({ role: 'player', nerve: 12 });
      services.enrolments.rememberedRole.mockReturnValue(null);

      const res = await request(server).get('/api/game/me').expect(200);

      const sent = res.body as Record<string, unknown>;
      expect(Object.keys(sent).sort()).toEqual([
        'enrolment',
        'rememberedRole',
        'season',
        'user',
      ]);
      expect(sent.season).toMatchObject({ slug: 'season-zero' });
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
