import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  // Render sends SIGTERM on deploy; this lets TypeORM close the pool cleanly.
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4000, '0.0.0.0');
}
void bootstrap();
