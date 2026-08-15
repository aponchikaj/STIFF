import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

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
    next();
  });
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
      'https://stiff.ge',
      'https://www.stiff.ge',
      'https://stage.stiff.ge',
      'https://pre-prod.stiff.ge',
    ],
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
