import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { GameAttempt } from './entities/game-attempt.entity';
import { GameSeason } from './entities/game-season.entity';
import { GameAdminService } from './game-admin.service';

/**
 * Running a season.
 *
 * The verdict is the sharp edge here: it is the only thing that puts an
 * attempt into the feed *and* the only thing that pays Nerve, and the score is
 * what ranks the season. Paying it twice is not a cosmetic bug, so the
 * transition is claimed rather than read-then-written.
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
  let claim: jest.Mock;

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
    // Matched the transition; this caller owns it.
    claim = jest.fn().mockResolvedValue([[{ id: 'a1' }], 1]);

    const dataSource = {
      transaction: jest.fn(
        async (cb: (m: unknown) => Promise<unknown>) =>
          await cb({ query: claim }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameAdminService,
        { provide: getRepositoryToken(GameSeason), useValue: seasonRepo },
        { provide: getRepositoryToken(GameAttempt), useValue: attemptRepo },
        { provide: DataSource, useValue: dataSource },
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

  describe('settle', () => {
    it('publishes an approved attempt', async () => {
      await service.settle('a1', { verdict: 'approve', nerve: 25 });
      expect(claim).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "game_attempts"'),
        ['a1', 'published'],
      );
    });

    it('rejects without publishing', async () => {
      await service.settle('a1', { verdict: 'reject' });
      expect(claim).toHaveBeenCalledWith(expect.anything(), ['a1', 'rejected']);
    });

    it('pays the Nerve and moves the tie-break timestamp', async () => {
      await service.settle('a1', { verdict: 'approve', nerve: 25 });
      expect(claim).toHaveBeenCalledWith(
        expect.stringContaining('"nerve" = "nerve" + $2'),
        ['e1', 25],
      );
    });

    it('pays nothing on a rejection, whatever was sent', async () => {
      await service.settle('a1', { verdict: 'reject', nerve: 999 });
      const paid = claim.mock.calls.some(([sql]: [string]) =>
        sql.includes('"nerve"'),
      );
      expect(paid).toBe(false);
    });

    it('pays nothing when the award is zero', async () => {
      await service.settle('a1', { verdict: 'approve', nerve: 0 });
      const paid = claim.mock.calls.some(([sql]: [string]) =>
        sql.includes('"nerve"'),
      );
      expect(paid).toBe(false);
    });

    it('never pays a negative award', async () => {
      await service.settle('a1', { verdict: 'approve', nerve: -50 });
      const paid = claim.mock.calls.some(([sql]: [string]) =>
        sql.includes('"nerve"'),
      );
      expect(paid).toBe(false);
    });

    /**
     * The reason the transition is claimed. Two reviewers opening the same
     * item would otherwise both settle it and both pay its Nerve.
     */
    it('refuses when someone else already settled it', async () => {
      claim.mockResolvedValue([[], 0]);
      await expect(
        service.settle('a1', { verdict: 'approve', nerve: 25 }),
      ).rejects.toThrow(ConflictException);
    });

    it('pays nothing at all when it loses that race', async () => {
      claim.mockResolvedValue([[], 0]);
      await expect(
        service.settle('a1', { verdict: 'approve', nerve: 25 }),
      ).rejects.toThrow();
      expect(claim).toHaveBeenCalledTimes(1);
    });

    /** Ash never returns, so the floor is in the statement. */
    it('burns a heart without going below zero', async () => {
      await service.settle('a1', { verdict: 'reject', burnHeart: true });
      expect(claim).toHaveBeenCalledWith(
        expect.stringContaining('GREATEST("heartsRemaining" - 1, 0)'),
        ['e1'],
      );
    });

    it('leaves hearts alone unless asked', async () => {
      await service.settle('a1', { verdict: 'reject' });
      const burnt = claim.mock.calls.some(([sql]: [string]) =>
        sql.includes('heartsRemaining'),
      );
      expect(burnt).toBe(false);
    });

    it('is a 404 for an attempt that is not there', async () => {
      attemptRepo.findOne.mockResolvedValue(null);
      await expect(
        service.settle('a1', { verdict: 'approve' }),
      ).rejects.toThrow(NotFoundException);
    });

    /** Nothing was uploaded, so there is nothing to have a verdict about. */
    it('refuses to settle a day nobody handed in', async () => {
      attemptRepo.findOne.mockResolvedValue(
        attempt({ status: 'awaiting_upload' }),
      );
      await expect(
        service.settle('a1', { verdict: 'approve' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('unpublish', () => {
    it('takes it back out of the feed', async () => {
      await service.unpublish('a1');
      expect(attemptRepo.query).toHaveBeenCalledWith(
        expect.stringContaining(`"status" = 'rejected'`),
        ['a1'],
      );
    });

    it('refuses something that is not in the feed', async () => {
      attemptRepo.query.mockResolvedValue([[], 0]);
      await expect(service.unpublish('a1')).rejects.toThrow(ConflictException);
    });

    /**
     * Deliberately does not claw the Nerve back. A score that moves after the
     * fact reorders a board people have already seen; the compensating ledger
     * entry that does it properly is Level 5's job.
     */
    it('does not touch the score', async () => {
      await service.unpublish('a1');
      const touched = attemptRepo.query.mock.calls.some(([sql]: [string]) =>
        sql.includes('"nerve"'),
      );
      expect(touched).toBe(false);
    });
  });
});
