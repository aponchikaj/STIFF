import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { GameSeason } from './entities/game-season.entity';
import { SeasonsService } from './seasons.service';

/**
 * A season starts itself at `startsAt`, so opal 001 unlocks on the minute
 * with nobody at the panel — and only an `open` season, only once.
 */
describe('SeasonsService', () => {
  let service: SeasonsService;
  let repo: { findOne: jest.Mock; query: jest.Mock };

  beforeEach(async () => {
    repo = { findOne: jest.fn(), query: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeasonsService,
        { provide: getRepositoryToken(GameSeason), useValue: repo },
      ],
    }).compile();
    service = module.get(SeasonsService);
  });

  describe('startDue', () => {
    it('starts open seasons whose start has come, in one conditional statement', async () => {
      repo.query.mockResolvedValue([[{ id: 's1', title: 'Zero' }], 1]);

      expect(await service.startDue()).toBe(1);

      const [sql] = repo.query.mock.calls[0] as [string];
      expect(sql).toContain(`SET "status" = 'running'`);
      expect(sql).toContain(`"status" = 'open'`);
      expect(sql).toContain('"startsAt" IS NOT NULL');
      expect(sql).toContain('"startsAt" <= now()');
    });

    it('starts nothing when nothing is due', async () => {
      repo.query.mockResolvedValue([[], 0]);
      expect(await service.startDue()).toBe(0);
    });
  });
});
