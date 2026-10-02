import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, type INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createRedisClient } from './common/redis/ioredis.adapter';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Server, type ServerOptions } from 'socket.io';

/**
 * Every origin allowed to call this API with credentials.
 *
 * Named one host at a time, never a wildcard: a subdomain nobody serves is a
 * subdomain someone else can take, and this list is what stands between a
 * stolen session cookie and a page that can use it.
 *
 * **Two domains, not one.** The shop and its panels are on stiff.ge; the game
 * and its panel are on stiff.co. One Nest app serves both, so both belong
 * here — and because they are different registrable domains, every call the
 * game's panel makes is cross-site unless it is proxied first-party.
 */
export function corsOrigins(): string[] {
  return [
    ...new Set([
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
      process.env.STAFF_FRONTEND_URL ?? 'http://localhost:3001',
      process.env.ADMIN_FRONTEND_URL ?? 'http://localhost:3002',
      process.env.GAME_FRONTEND_URL ?? 'http://localhost:3003',
      process.env.GAME_ADMIN_FRONTEND_URL ?? 'http://localhost:3004',
      'https://stiff.ge',
      'https://www.stiff.ge',
      'https://staff.stiff.ge',
      'https://admin.stiff.ge',
      'https://stage.stiff.ge',
      'https://pre-prod.stiff.ge',
      // The game, and the panel that runs it.
      'https://stiff.co',
      'https://www.stiff.co',
      'https://admin.stiff.co',
      // Kept while the old host may still be pointed somewhere. The game is
      // named Stiff and lives at stiff.co; when nothing serves this any more
      // it should come out, because an unserved subdomain is a liability.
      'https://game.stiff.ge',
    ]),
  ];
}

/**
 * Socket.IO with the shop's CORS list and, when Redis is configured, a
 * cross-instance adapter.
 *
 * The adapter is the part that matters for scaling. Socket.IO's default keeps
 * its room membership in process memory, so a staff chat message emitted on
 * instance A never reaches a colleague connected to instance B. Nothing errors
 * — the message is simply delivered to the subset of people who happened to
 * land on the same process — which is the worst way for a chat to break.
 *
 * Redis is optional here for the same reason it is everywhere else: unset, the
 * behaviour is exactly what it is today and correct for one instance.
 */
export class CorsIoAdapter extends IoAdapter {
  private readonly logger = new Logger(CorsIoAdapter.name);

  constructor(
    app: INestApplicationContext,
    private readonly redisUrl?: string,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: corsOrigins(), credentials: true },
    }) as Server;

    if (!this.redisUrl) {
      this.logger.warn(
        'No REDIS_URL — staff chat is confined to one process. Correct for a ' +
          'single instance; messages go missing across two.',
      );
      return server;
    }

    // The adapter needs two connections: one publishing, one subscribed. A
    // subscribed ioredis client cannot run ordinary commands, so it cannot be
    // the same client the rest of the app uses.
    const pub = createRedisClient(this.redisUrl);
    const sub = pub.duplicate();
    server.adapter(createAdapter(pub, sub));
    this.logger.log('Staff chat fans out across instances via Redis');
    return server;
  }
}

/** Shared by `main.ts` and e2e so production routing is what the tests exercise. */
export function configureApp(app: NestExpressApplication): void {
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  // Render (and any TLS terminator) sits in front of the process. Without
  // this, Express sees the proxy's IP and Secure cookies / rate limits break.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // UptimeRobot and similar probes hit the host root. Everything else stays
  // under /api — except GET / which must 200 or the monitor files an incident.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: '', method: RequestMethod.GET },
      { path: '/', method: RequestMethod.GET },
    ],
  });
  app.use(cookieParser());
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), display-capture=(), geolocation=()',
    );
    // Two years, subdomains included, so admin.stiff.ge and staff.stiff.ge are
    // covered too. Production only: sending this over plain HTTP in dev would
    // pin localhost to https in the browser and break the next `npm run dev`.
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload',
      );
    }
    next();
  });
  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  // Served outside the /api prefix: http://localhost:4000/uploads/<file>
  app.useStaticAssets(uploadsDir, { prefix: '/uploads' });
}
