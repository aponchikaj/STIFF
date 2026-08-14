import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataSource } from 'typeorm';

describe('AppController', () => {
  let appController: AppController;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: DataSource,
          useValue: { query },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports ok when the database answers', async () => {
      const body = await appController.health();
      expect(query).toHaveBeenCalledWith('SELECT 1');
      expect(body.status).toBe('ok');
      expect(body.database).toBe('up');
    });

    it('reports degraded when the database does not answer', async () => {
      query.mockRejectedValueOnce(new Error('connection refused'));
      const body = await appController.rootHealth();
      expect(body.status).toBe('degraded');
      expect(body.database).toBe('down');
    });
  });
});
