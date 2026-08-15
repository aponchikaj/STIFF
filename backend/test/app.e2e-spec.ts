import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';
import type { HealthStatus } from './../src/app.service';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication);
    await app.init();
  });

  it('/ (GET) answers without the /api prefix so host-root monitors succeed', async () => {
    const res = await request(app.getHttpServer() as Server)
      .get('/')
      .expect(200);
    const body = res.body as HealthStatus;
    expect(body.status).toMatch(/^(ok|degraded)$/);
    expect(body.database).toMatch(/^(up|down)$/);
  });

  afterEach(async () => {
    await app.close();
  });
});
