import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { LeaderLockService } from '../common/redis/leader-lock.service';
import { User } from '../users/user.entity';
import { VoteResolverService } from './ai/vote-resolver.service';
import { GameAttemptVote } from './entities/game-attempt-vote.entity';
import { GameAttempt } from './entities/game-attempt.entity';
import { GameTaskTemplate } from './entities/game-task-template.entity';
import { EnrolmentsService } from './enrolments.service';
import { SeasonsService } from './seasons.service';
import { VerdictsService } from './verdicts.service';
import { cooldownLeft, VotingService } from './voting.service';

/**
 * The watchers' vote.
 *
 * What these hold: only a watcher votes, only while the window is open, one
 * vote each; the window is claimed before the resolver looks, so nothing is
 * resolved twice; and whatever the resolver cannot say is handed to a person
 * rather than dropped.
 */

const WATCHER = { id: 'u1', username: 'kate' } as User;
const NOW = new Date('2026-09-11T12:00:00.000Z');

function attempt(overrides: Partial<GameAttempt> = {}): GameAttempt {
  return {
    id: 'a1',
    seasonId: 's1',
    enrolmentId: 'p1',
    taskTemplateId: 't1',
    day: 2,
    kind: 'photo',
    status: 'submitted',
    mediaUrl: 'https://media.stiff.ge/x.jpg',
    caption: null,
    votingStatus: 'open',
    votingEndsAt: new Date(NOW.getTime() + 60 * 60_000),
    enrolment: { handle: 'asterisk' },
    taskTemplate: { title: 'T', brief: 'B', proof: 'photo' },
    ...overrides,
  } as unknown as GameAttempt;
}

/** A chainable builder whose only terminal is `getRawMany`. */
function rawBuilder(rows: unknown[]) {
  const qb: Record<string, jest.Mock> = {};
  for (const name of [
    'select',
    'addSelect',
    'where',
    'groupBy',
    'addGroupBy',
  ]) {
    qb[name] = jest.fn(() => qb);
  }
  qb.getRawMany = jest.fn().mockResolvedValue(rows);
  return qb;
}

describe('VotingService', () => {
  let service: VotingService;
  let attemptRepo: Record<string, jest.Mock>;
  let voteRepo: Record<string, jest.Mock>;
  let templateRepo: { findOne: jest.Mock };
  let seasons: { requireCurrent: jest.Mock };
  let enrolments: { require: jest.Mock };
  let resolver: { resolve: jest.Mock };
  let verdicts: { settle: jest.Mock };
  let leaderLock: { withLock: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers({ now: NOW });

    attemptRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(attempt()),
      query: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    voteRepo = {
      find: jest.fn().mockResolvedValue([]),
      // A returned row is the database saying the vote landed.
      query: jest.fn().mockResolvedValue([{ id: 'v1' }]),
      createQueryBuilder: jest.fn(() =>
        rawBuilder([
          { attemptId: 'a1', vote: 'yes', count: '3' },
          { attemptId: 'a1', vote: 'no', count: '1' },
        ]),
      ),
    };
    templateRepo = { findOne: jest.fn().mockResolvedValue({ id: 't1' }) };
    seasons = { requireCurrent: jest.fn().mockResolvedValue({ id: 's1' }) };
    enrolments = {
      require: jest
        .fn()
        .mockResolvedValue({ id: 'w1', role: 'watcher', lastVoteWinAt: null }),
    };
    resolver = {
      resolve: jest.fn().mockResolvedValue({
        outcome: 'confirmed',
        confidence: 0.9,
        payout: 3,
        reasons: ['Visible'],
        model: 'm',
      }),
    };
    verdicts = { settle: jest.fn().mockResolvedValue(attempt()) };
    leaderLock = {
      withLock: jest.fn(
        (_name: string, _ttl: number, job: () => Promise<unknown>) => job(),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VotingService,
        { provide: getRepositoryToken(GameAttempt), useValue: attemptRepo },
        { provide: getRepositoryToken(GameAttemptVote), useValue: voteRepo },
        {
          provide: getRepositoryToken(GameTaskTemplate),
          useValue: templateRepo,
        },
        { provide: SeasonsService, useValue: seasons },
        { provide: EnrolmentsService, useValue: enrolments },
        { provide: VoteResolverService, useValue: resolver },
        { provide: VerdictsService, useValue: verdicts },
        { provide: LeaderLockService, useValue: leaderLock },
      ],
    }).compile();

    service = module.get(VotingService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('open', () => {
    it('is for watchers', async () => {
      await service.open(WATCHER);
      expect(enrolments.require).toHaveBeenCalledWith(WATCHER, 'watcher');
    });

    it('asks for submitted attempts with an open vote in the live season', async () => {
      await service.open(WATCHER);
      const [options] = attemptRepo.find.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(options.where).toEqual({
        seasonId: 's1',
        status: 'submitted',
        votingStatus: 'open',
      });
    });

    it('returns nothing when nothing is live', async () => {
      expect(await service.open(WATCHER)).toEqual([]);
      expect(voteRepo.find).not.toHaveBeenCalled();
    });

    it('drops a window that has already passed', async () => {
      attemptRepo.find.mockResolvedValue([
        attempt({ id: 'old', votingEndsAt: new Date(NOW.getTime() - 1000) }),
        attempt(),
      ]);
      const items = await service.open(WATCHER);
      expect(items.map((i) => i.id)).toEqual(['a1']);
    });

    it('carries the tallies, my vote and the seconds left', async () => {
      attemptRepo.find.mockResolvedValue([attempt()]);
      voteRepo.find.mockResolvedValue([{ attemptId: 'a1', vote: 'no' }]);
      const [item] = await service.open(WATCHER);
      expect(item).toMatchObject({
        id: 'a1',
        yes: 3,
        no: 1,
        myVote: 'no',
        secondsLeft: 3600,
        player: { handle: 'asterisk' },
        task: { title: 'T', brief: 'B', proof: 'photo' },
      });
      expect(item.votingEndsAt).toBe(
        new Date(NOW.getTime() + 60 * 60_000).toISOString(),
      );
    });

    it('reads my vote as null when I have not voted', async () => {
      attemptRepo.find.mockResolvedValue([attempt()]);
      const [item] = await service.open(WATCHER);
      expect(item.myVote).toBeNull();
    });
  });

  describe('vote', () => {
    it('is for watchers', async () => {
      await service.vote(WATCHER, 'a1', 'yes');
      expect(enrolments.require).toHaveBeenCalledWith(WATCHER, 'watcher');
    });

    it('404s an unknown attempt', async () => {
      attemptRepo.findOne.mockResolvedValue(null);
      await expect(service.vote(WATCHER, 'a1', 'yes')).rejects.toThrow(
        NotFoundException,
      );
    });

    it.each([
      ['not submitted', { status: 'published' as const }],
      ['not open', { votingStatus: 'resolved' as const }],
      ['no window', { votingEndsAt: null }],
      ['window past', { votingEndsAt: new Date(NOW.getTime() - 1) }],
    ])('refuses when the vote is %s', async (_label, overrides) => {
      attemptRepo.findOne.mockResolvedValue(attempt(overrides));
      await expect(service.vote(WATCHER, 'a1', 'yes')).rejects.toThrow(
        /closed/,
      );
      expect(voteRepo.query).not.toHaveBeenCalled();
    });

    it('writes one row per watcher, re-checking the window in the statement', async () => {
      await service.vote(WATCHER, 'a1', 'no');
      const [sql, params] = voteRepo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(
        /ON CONFLICT \("attemptId", "enrolmentId"\) DO UPDATE/,
      );
      expect(sql).toMatch(/"votingEndsAt" > now\(\)/);
      expect(sql).toMatch(/"paidCoins" = 0/);
      expect(params).toEqual(['a1', 'w1', 'u1', 'no']);
    });

    it('refuses when the statement wrote nothing', async () => {
      voteRepo.query.mockResolvedValue([]);
      await expect(service.vote(WATCHER, 'a1', 'yes')).rejects.toThrow(
        ConflictException,
      );
    });

    it('answers with the tallies and no cooldown for a first-time winner', async () => {
      const result = await service.vote(WATCHER, 'a1', 'yes');
      expect(result).toEqual({
        attemptId: 'a1',
        vote: 'yes',
        yes: 3,
        no: 1,
        cooldownSecondsLeft: 0,
      });
    });

    it('reports the cooldown left after a recent win', async () => {
      enrolments.require.mockResolvedValue({
        id: 'w1',
        role: 'watcher',
        lastVoteWinAt: new Date(NOW.getTime() - 60 * 60_000),
      });
      const result = await service.vote(WATCHER, 'a1', 'yes');
      expect(result.cooldownSecondsLeft).toBe(4 * 3600);
    });
  });

  describe('resolveDue', () => {
    it('claims closed windows with a conditional UPDATE', async () => {
      await service.resolveDue();
      const [sql] = attemptRepo.query.mock.calls[0] as [string];
      expect(sql).toMatch(/SET "votingStatus" = 'resolving'/);
      expect(sql).toMatch(/"votingStatus" = 'open'/);
      expect(sql).toMatch(/"votingEndsAt" <= now\(\)/);
      expect(sql).toMatch(/"status" = 'submitted'/);
    });

    it('does nothing when nothing is due', async () => {
      expect(await service.resolveDue()).toEqual({
        resolved: 0,
        deferred: 0,
        skipped: 0,
      });
      expect(resolver.resolve).not.toHaveBeenCalled();
    });

    it('skips an attempt a person settled in between', async () => {
      attemptRepo.query.mockResolvedValue([{ id: 'a1' }]);
      attemptRepo.findOne.mockResolvedValue(attempt({ status: 'published' }));
      expect(await service.resolveDue()).toEqual({
        resolved: 0,
        deferred: 0,
        skipped: 1,
      });
      expect(resolver.resolve).not.toHaveBeenCalled();
    });

    it('gives the resolver the attempt, its task and the tallies', async () => {
      attemptRepo.query.mockResolvedValue([{ id: 'a1' }]);
      await service.resolveDue();
      expect(templateRepo.findOne).toHaveBeenCalledWith({
        where: { id: 't1' },
      });
      expect(resolver.resolve).toHaveBeenCalledWith({
        attempt: expect.objectContaining({ id: 'a1' }) as unknown,
        template: { id: 't1' },
        yes: 3,
        no: 1,
      });
    });

    it('does not load a task when there is none', async () => {
      attemptRepo.query.mockResolvedValue([{ id: 'a1' }]);
      attemptRepo.findOne.mockResolvedValue(attempt({ taskTemplateId: null }));
      await service.resolveDue();
      expect(templateRepo.findOne).not.toHaveBeenCalled();
    });

    it('approves through the verdicts service when confirmed', async () => {
      attemptRepo.query.mockResolvedValue([{ id: 'a1' }]);
      const result = await service.resolveDue();
      expect(verdicts.settle).toHaveBeenCalledWith('a1', {
        verdict: 'approve',
        reason: undefined,
        by: 'resolver',
        resolution: expect.objectContaining({
          outcome: 'confirmed',
        }) as unknown,
      });
      expect(result.resolved).toBe(1);
    });

    it('rejects with the first reason when not confirmed', async () => {
      attemptRepo.query.mockResolvedValue([{ id: 'a1' }]);
      resolver.resolve.mockResolvedValue({
        outcome: 'not_confirmed',
        confidence: 0.8,
        payout: 2,
        reasons: ['Nothing on the spoon'],
        model: 'm',
      });
      await service.resolveDue();
      expect(verdicts.settle).toHaveBeenCalledWith(
        'a1',
        expect.objectContaining({
          verdict: 'reject',
          reason: 'Nothing on the spoon',
          by: 'resolver',
        }),
      );
    });

    it('defers to a person when unsure, keeping the tallies on the row', async () => {
      attemptRepo.query.mockResolvedValue([{ id: 'a1' }]);
      resolver.resolve.mockResolvedValue({
        outcome: 'unsure',
        confidence: 0,
        payout: 3,
        reasons: ['Clips are not judged'],
        model: null,
      });
      const result = await service.resolveDue();
      expect(verdicts.settle).not.toHaveBeenCalled();
      expect(attemptRepo.update).toHaveBeenCalledWith(
        { id: 'a1', votingStatus: 'resolving' },
        {
          votingStatus: 'deferred',
          voting: expect.objectContaining({
            outcome: 'unsure',
            by: 'resolver',
            yes: 3,
            no: 1,
            paid: 0,
            cooling: 0,
          }) as unknown,
        },
      );
      expect(result.deferred).toBe(1);
    });

    it('hands a failure to a person rather than leave it resolving', async () => {
      attemptRepo.query.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
      resolver.resolve
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({
          outcome: 'confirmed',
          confidence: 1,
          payout: 2,
          reasons: [],
          model: 'm',
        });
      const result = await service.resolveDue();
      expect(result).toEqual({ resolved: 1, deferred: 0, skipped: 1 });
      expect(attemptRepo.update).toHaveBeenCalledWith(
        { id: 'a1', votingStatus: 'resolving' },
        { votingStatus: 'deferred' },
      );
    });
  });

  describe('the cron', () => {
    it('runs through the leader lock', async () => {
      await service.sweepVotes();
      expect(leaderLock.withLock).toHaveBeenCalledWith(
        'gameVotes',
        expect.any(Number),
        expect.any(Function),
      );
    });

    it('logs a failure rather than throwing into the scheduler', async () => {
      leaderLock.withLock.mockRejectedValue(new Error('database gone'));
      await expect(service.sweepVotes()).resolves.toBeUndefined();
    });
  });

  describe('cooldownLeft', () => {
    it('is zero with no win on record', () => {
      expect(cooldownLeft(null, NOW)).toBe(0);
    });

    it('counts down five hours from the win', () => {
      expect(cooldownLeft(new Date(NOW.getTime() - 2 * 3600_000), NOW)).toBe(
        3 * 3600,
      );
    });

    it('is zero once the five hours have passed', () => {
      expect(cooldownLeft(new Date(NOW.getTime() - 6 * 3600_000), NOW)).toBe(0);
    });
  });
});
