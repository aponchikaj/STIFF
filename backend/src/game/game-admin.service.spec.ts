import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { GameAttempt } from './entities/game-attempt.entity';
import { GameEnrolment } from './entities/game-enrolment.entity';
import { GameSeason } from './entities/game-season.entity';
import { GameAdminService } from './game-admin.service';
import { SeasonsService } from './seasons.service';
import { VerdictsService } from './verdicts.service';

/**
 * Running a season: the seasons themselves, and who is in them.
 *
 * The verdict used to live here. It moved to `VerdictsService` when the
 * vote resolver became a second thing that settles an attempt, and its
 * tests moved with it (`verdicts.service.spec.ts`); what stays is that
 * this service still hands the panel's calls through unchanged.
 */

function attempt(overrides: Partial<GameAttempt> = {}): GameAttempt {
  return {
    id: 'a1',
    enrolmentId: 'e1',
    status: 'submitted',
    ...overrides,
  } as GameAttempt;
}

describe('GameAdminService', () => {
  let service: GameAdminService;
  let seasonRepo: Record<string, jest.Mock>;
  let attemptRepo: Record<string, jest.Mock>;
  let enrolmentRepo: Record<string, jest.Mock>;
  let seasons: { current: jest.Mock };
  let verdicts: { settle: jest.Mock; unpublish: jest.Mock };

  beforeEach(async () => {
    seasonRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((s: unknown) =>
        Promise.resolve({ id: 's1', ...(s as object) }),
      ),
      create: jest.fn((s: unknown) => s),
    };
    attemptRepo = {
      findOne: jest.fn().mockResolvedValue(attempt()),
      createQueryBuilder: jest.fn(),
      query: jest.fn().mockResolvedValue([[{ id: 'a1' }], 1]),
    };
    enrolmentRepo = { find: jest.fn().mockResolvedValue([]) };
    seasons = { current: jest.fn().mockResolvedValue({ id: 's1' }) };
    verdicts = { settle: jest.fn(), unpublish: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameAdminService,
        { provide: getRepositoryToken(GameSeason), useValue: seasonRepo },
        { provide: getRepositoryToken(GameAttempt), useValue: attemptRepo },
        { provide: getRepositoryToken(GameEnrolment), useValue: enrolmentRepo },
        { provide: SeasonsService, useValue: seasons },
        { provide: VerdictsService, useValue: verdicts },
      ],
    }).compile();

    service = module.get(GameAdminService);
  });

  describe('createSeason', () => {
    it('starts every season in draft', async () => {
      const season = await service.createSeason({
        slug: 'zero',
        title: 'Zero',
      });
      expect(season.status).toBe('draft');
    });

    it('lowercases and trims the slug', async () => {
      await service.createSeason({ slug: '  Season-ZERO ', title: ' Zero ' });
      expect(seasonRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'season-zero', title: 'Zero' }),
      );
    });

    it('defaults to three hearts', async () => {
      await service.createSeason({ slug: 'zero', title: 'Zero' });
      expect(seasonRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ startingHearts: 3 }),
      );
    });

    it('refuses a slug already taken', async () => {
      seasonRepo.findOne.mockResolvedValue({ id: 'other' });
      await expect(
        service.createSeason({ slug: 'zero', title: 'Zero' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('setSeasonStatus', () => {
    it('is a 404 for a season that is not there', async () => {
      seasonRepo.findOne.mockResolvedValue(null);
      await expect(service.setSeasonStatus('s1', 'open')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('does nothing when the status is already that', async () => {
      seasonRepo.findOne.mockResolvedValue({ id: 's1', status: 'open' });
      await service.setSeasonStatus('s1', 'open');
      expect(seasonRepo.save).not.toHaveBeenCalled();
    });

    /**
     * `SeasonsService.current()` answers with the newest live season, so a
     * second one would silently take over the front door and strand everyone
     * enrolled in the first.
     */
    it('refuses to open a second season while one is live', async () => {
      seasonRepo.findOne
        .mockResolvedValueOnce({ id: 's2', status: 'draft' })
        .mockResolvedValueOnce({ id: 's1', title: 'Season Zero' });

      await expect(service.setSeasonStatus('s2', 'open')).rejects.toThrow(
        /Season Zero.*still live/,
      );
    });

    it('lets a season move from open to running', async () => {
      seasonRepo.findOne
        .mockResolvedValueOnce({ id: 's1', status: 'open' })
        .mockResolvedValueOnce({ id: 's1' });

      const season = await service.setSeasonStatus('s1', 'running');
      expect(season.status).toBe('running');
      expect(season.startsAt).toBeInstanceOf(Date);
    });

    it('stamps the end when it closes', async () => {
      seasonRepo.findOne.mockResolvedValue({ id: 's1', status: 'running' });
      const season = await service.setSeasonStatus('s1', 'closed');
      expect(season.endsAt).toBeInstanceOf(Date);
    });

    /** Closing never checks for another live season — that is the way out. */
    it('can always close', async () => {
      seasonRepo.findOne.mockResolvedValue({ id: 's1', status: 'running' });
      await expect(
        service.setSeasonStatus('s1', 'closed'),
      ).resolves.toMatchObject({ status: 'closed' });
    });
  });

  describe('the schedule', () => {
    const HOUR = 3_600_000;

    it('schedules a start and derives the end: three opals of 24 hours', async () => {
      const startsAt = new Date(Date.now() + 48 * HOUR);
      seasonRepo.findOne.mockResolvedValue({ id: 's1', status: 'open' });

      const season = await service.scheduleSeason('s1', startsAt);

      expect(season.startsAt).toEqual(startsAt);
      expect(season.endsAt?.getTime()).toBe(startsAt.getTime() + 72 * HOUR);
    });

    it('can schedule a draft, so it is ready before it opens', async () => {
      seasonRepo.findOne.mockResolvedValue({ id: 's1', status: 'draft' });
      await expect(
        service.scheduleSeason('s1', new Date(Date.now() + HOUR)),
      ).resolves.toMatchObject({ status: 'draft' });
    });

    it('refuses a start in the past or the next minute', async () => {
      seasonRepo.findOne.mockResolvedValue({ id: 's1', status: 'open' });
      await expect(
        service.scheduleSeason('s1', new Date(Date.now() + 30_000)),
      ).rejects.toThrow(BadRequestException);
      expect(seasonRepo.save).not.toHaveBeenCalled();
    });

    it('will not move the start of a season already running', async () => {
      seasonRepo.findOne.mockResolvedValue({
        id: 's1',
        title: 'Zero',
        status: 'running',
      });
      await expect(
        service.scheduleSeason('s1', new Date(Date.now() + HOUR)),
      ).rejects.toThrow(ConflictException);
    });

    it('clears the schedule with null', async () => {
      seasonRepo.findOne.mockResolvedValue({
        id: 's1',
        status: 'open',
        startsAt: new Date(Date.now() + HOUR),
        endsAt: new Date(Date.now() + 73 * HOUR),
      });
      await expect(service.scheduleSeason('s1', null)).resolves.toMatchObject({
        startsAt: null,
        endsAt: null,
      });
    });

    /**
     * Started by hand ahead of schedule: the opals count from `startsAt`,
     * so it moves to now — otherwise the season would be running with 001
     * still locked, dealing nothing.
     */
    it('moves a future start to now when the season is started by hand', async () => {
      const scheduled = new Date(Date.now() + 10 * HOUR);
      seasonRepo.findOne
        .mockResolvedValueOnce({
          id: 's1',
          status: 'open',
          startsAt: scheduled,
        })
        .mockResolvedValueOnce({ id: 's1' });

      const season = await service.setSeasonStatus('s1', 'running');

      expect(season.startsAt!.getTime()).toBeLessThanOrEqual(Date.now());
      expect(season.endsAt!.getTime() - season.startsAt!.getTime()).toBe(
        72 * HOUR,
      );
    });

    it('keeps a start that has already passed when started by hand', async () => {
      const passed = new Date(Date.now() - HOUR);
      seasonRepo.findOne
        .mockResolvedValueOnce({ id: 's1', status: 'open', startsAt: passed })
        .mockResolvedValueOnce({ id: 's1' });

      const season = await service.setSeasonStatus('s1', 'running');
      expect(season.startsAt).toEqual(passed);
    });
  });

  describe('listEnrolments', () => {
    it('is empty between seasons rather than an error', async () => {
      seasons.current.mockResolvedValue(null);
      await expect(service.listEnrolments()).resolves.toEqual([]);
      expect(enrolmentRepo.find).not.toHaveBeenCalled();
    });

    it('scopes to the live season and the filters given', async () => {
      await service.listEnrolments({ status: 'cheater', role: 'watcher' });
      expect(enrolmentRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { seasonId: 's1', status: 'cheater', role: 'watcher' },
        }),
      );
    });

    it('clamps the limit', async () => {
      await service.listEnrolments({ limit: 9999 });
      expect(enrolmentRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 500 }),
      );
    });
  });

  describe('delegation', () => {
    /**
     * Two things settle an attempt now — the panel and the vote resolver —
     * so the logic lives in `VerdictsService` and this is only its door.
     */
    it('hands settle to the verdicts service and returns its answer', async () => {
      const settled = attempt({ status: 'published' });
      verdicts.settle.mockResolvedValue(settled);
      const opts = { verdict: 'approve' as const, nerve: 25, by: 'admin-1' };
      await expect(service.settle('a1', opts)).resolves.toBe(settled);
      expect(verdicts.settle).toHaveBeenCalledWith('a1', opts);
    });

    it('hands unpublish to the verdicts service', async () => {
      const back = attempt({ status: 'rejected' });
      verdicts.unpublish.mockResolvedValue(back);
      await expect(service.unpublish('a1')).resolves.toBe(back);
      expect(verdicts.unpublish).toHaveBeenCalledWith('a1', {});
    });

    /** The clawback row names who took it back. */
    it('passes the admin through to unpublish', async () => {
      verdicts.unpublish.mockResolvedValue(attempt({ status: 'rejected' }));
      await service.unpublish('a1', { by: 'admin-1' });
      expect(verdicts.unpublish).toHaveBeenCalledWith('a1', { by: 'admin-1' });
    });
  });
});
