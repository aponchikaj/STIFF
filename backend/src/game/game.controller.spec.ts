import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'http';
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
  enrolments: { enrol: jest.fn(), mine: jest.fn() },
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
};

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
      expect(services.enrolments.enrol).not.toHaveBeenCalled();
    });

    it('accepts both real roles', async () => {
      services.enrolments.enrol.mockResolvedValue({ role: 'watcher' });
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
      services.enrolments.enrol.mockResolvedValue({ role: 'player' });
      await request(server)
        .post('/api/game/enrolments')
        .send({ role: 'player', nerve: 9999 })
        .expect(201);
      expect(services.enrolments.enrol).toHaveBeenCalledWith(
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
});
