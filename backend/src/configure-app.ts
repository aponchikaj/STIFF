import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Server, type ServerOptions } from 'socket.io';

export function corsOrigins(): string[] {
  return [
    ...new Set([
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
      process.env.STAFF_FRONTEND_URL ?? 'http://localhost:3001',
      process.env.ADMIN_FRONTEND_URL ?? 'http://localhost:3002',
      'https://stiff.ge',
      'https://www.stiff.ge',
      'https://staff.stiff.ge',
      'https://admin.stiff.ge',
      'https://stage.stiff.ge',
      'https://pre-prod.stiff.ge',
    ]),
  ];
}

export class CorsIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions): Server {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: corsOrigins(), credentials: true },
    }) as Server;
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
