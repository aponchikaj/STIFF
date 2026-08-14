import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/** Shared by `main.ts` and e2e so production routing is what the tests exercise. */
export function configureApp(app: NestExpressApplication): void {
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  // UptimeRobot and similar probes hit the host root. Everything else stays
  // under /api — except GET / which must 200 or the monitor files an incident.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: '', method: RequestMethod.GET },
      { path: '/', method: RequestMethod.GET },
    ],
  });
  app.use(cookieParser());
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
