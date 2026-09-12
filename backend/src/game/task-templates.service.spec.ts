import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../users/user.entity';
import type { GeneratedTask } from './ai/task-generator.service';
import type { PipelineOutcome, ReviewedTask } from './ai/task-pipeline.service';
import type { ReviewVerdict } from './ai/task-reviewer.service';
import { GameGenerationRejection } from './entities/game-generation-rejection.entity';
import {
  GameTaskTemplate,
  type TaskReview,
} from './entities/game-task-template.entity';
import { TaskTemplatesService, normaliseSlug } from './task-templates.service';

/**
 * The task pool.
 *
 * Two properties carry the weight: a generated task lands as a draft and only
 * a person approves it, and the safety screen runs again *at approval* rather
 * than being trusted from generation time. Since the two-agent pipeline, a
 * third: the reviewer's no is kept on the row and stands until it is asked
 * again.
 */

const APPROVER = { id: 'u1', username: 'boss', role: 'admin' } as User;

function outcome(overrides: Partial<PipelineOutcome> = {}): PipelineOutcome {
  return {
    accepted: [],
    rejected: [],
    dropped: 0,
    rounds: 1,
    maxRounds: 3,
    charterHash: 'abc123def456',
    models: { creator: 'claude-opus-5', reviewer: 'claude-opus-5-reviewer' },
    usage: { inputTokens: 100, outputTokens: 900, cacheReadTokens: 4000 },
    ...overrides,
  };
}

function generated(overrides: Record<string, unknown> = {}): GeneratedTask {
  return {
    slug: 'nine',
    tier: 1 as const,
    title: 'Nine',
    brief:
      'Nine things in one room that are exactly the same colour. Take a photo.',
    proof: 'photo',
    mode: 'solo',
    rewardNerve: 10,
    rewardCoins: 2,
    penaltyCoins: 1,
    clockMinutes: 15,
    guards: [],
    criteria: [
      { id: 'c1', modality: 'visual', required: true, assert: 'Nine objects.' },
    ],
    rationale: 'Observation, indoors.',
    ...overrides,
  };
}

function approved(round = 1): TaskReview {
  return {
    verdict: 'approve',
    severity: 'ok',
    blockedTypes: [],
    reasons: ['Harmless, provable, indoors.'],
    feedback: null,
    model: 'claude-opus-5-reviewer',
    reviewedAt: '2026-09-11T10:00:00.000Z',
    round,
  };
}

/** An accepted task as the pipeline hands it over: the task and its review. */
function accepted(
  overrides: Record<string, unknown> = {},
  review: TaskReview = approved(),
): ReviewedTask {
  return { task: generated(overrides), review };
}

function rejectedByReviewer(): ReviewVerdict {
  return {
    verdict: 'reject',
    severity: 'illegal',
    blockedTypes: ['substances'],
    reasons: ['It asks the player to drink.'],
    feedback: 'That is alcohol. Write a gross-but-safe eating dare instead.',
    model: 'claude-opus-5-reviewer',
    reviewedAt: '2026-09-11T10:00:00.000Z',
  };
}

describe('TaskTemplatesService', () => {
  let service: TaskTemplatesService;
  let templateRepo: Record<string, jest.Mock>;
  let rejectionRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    templateRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((t: unknown) =>
        Promise.resolve({ id: 't1', ...(t as object) }),
      ),
      create: jest.fn((t: unknown) => t),
      count: jest.fn().mockResolvedValue(0),
      query: jest.fn().mockResolvedValue([[{ id: 't1' }], 1]),
    };
    rejectionRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((r: unknown) => Promise.resolve(r)),
      create: jest.fn((r: unknown) => r),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskTemplatesService,
        {
          provide: getRepositoryToken(GameTaskTemplate),
          useValue: templateRepo,
        },
        {
          provide: getRepositoryToken(GameGenerationRejection),
          useValue: rejectionRepo,
        },
      ],
    }).compile();

    service = module.get(TaskTemplatesService);
  });

  describe('fileBatch', () => {
    /** The rule the whole module is built around. */
    it('files everything a model wrote as a draft', async () => {
      await service.fileBatch(outcome({ accepted: [accepted()] }));
      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'draft', origin: 'generated' }),
      );
    });

    it('never files a generated task as approved', async () => {
      await service.fileBatch(
        outcome({ accepted: [accepted(), accepted({ slug: 'heavy' })] }),
      );
      const created = templateRepo.create.mock.calls as [{ status: string }][];
      for (const [row] of created) {
        expect(row.status).toBe('draft');
      }
    });

    /**
     * Records which rules wrote it, so "which live tasks predate the current
     * Charter" is a query rather than an archaeology project.
     */
    it('stamps the Charter and the creator model on every draft', async () => {
      await service.fileBatch(outcome({ accepted: [accepted()] }));
      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          charterHash: 'abc123def456',
          model: 'claude-opus-5',
        }),
      );
    });

    /** Every task says how it is proved, and the row keeps it. */
    it('saves the proof the creator chose', async () => {
      await service.fileBatch(
        outcome({ accepted: [accepted({ proof: 'video' })] }),
      );
      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ proof: 'video' }),
      );
    });

    it('defaults a missing proof to either', async () => {
      await service.fileBatch(
        outcome({ accepted: [accepted({ proof: undefined })] }),
      );
      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ proof: 'either' }),
      );
    });

    /** The verdict that let it through travels with it, round and all. */
    /** Who a task is for, and what it pays, are the creator's to write. */
    it('saves the mode and the economy fields the creator chose', async () => {
      await service.fileBatch(
        outcome({
          accepted: [
            accepted({
              mode: 'team',
              rewardNerve: 25,
              rewardCoins: 5,
              penaltyCoins: 2,
            }),
          ],
        }),
      );
      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'team',
          rewardNerve: 25,
          rewardCoins: 5,
          penaltyCoins: 2,
        }),
      );
    });

    it('defaults a missing mode to solo and missing rewards to nothing', async () => {
      await service.fileBatch(
        outcome({
          accepted: [
            accepted({
              mode: undefined,
              rewardNerve: undefined,
              rewardCoins: undefined,
              penaltyCoins: undefined,
            }),
          ],
        }),
      );
      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'solo',
          rewardNerve: 0,
          rewardCoins: 0,
          penaltyCoins: 1,
        }),
      );
    });

    /**
     * The penalty rule is one to three coins and the database holds it as a
     * CHECK; the service clamps first so a model that wrote 7 files a task
     * rather than failing the whole batch on the constraint.
     */
    it('rounds the rewards and clamps the penalty into one to three', async () => {
      await service.fileBatch(
        outcome({
          accepted: [
            accepted({
              rewardNerve: 12.6,
              rewardCoins: -3,
              penaltyCoins: 7,
            }),
          ],
        }),
      );
      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rewardNerve: 13,
          rewardCoins: 0,
          penaltyCoins: 3,
        }),
      );
    });

    it('saves the reviewer verdict on the draft', async () => {
      await service.fileBatch(
        outcome({ accepted: [accepted({}, approved(2))] }),
      );
      const [row] = templateRepo.create.mock.calls[0] as [
        { review: TaskReview },
      ];
      expect(row.review).toMatchObject({ verdict: 'approve', round: 2 });
    });

    /**
     * A model told to avoid the pool still lands on a taken name sometimes.
     * Losing the other nineteen over it is the worse outcome.
     */
    it('skips a slug already in the pool without failing the batch', async () => {
      templateRepo.find.mockResolvedValue([{ slug: 'nine' }]);

      const result = await service.fileBatch(
        outcome({ accepted: [accepted(), accepted({ slug: 'heavy' })] }),
      );

      expect(result.skipped).toEqual(['nine']);
      expect(result.saved).toHaveLength(1);
      expect(result.saved[0].slug).toBe('heavy');
    });

    /** The database would only catch this as a failed insert. */
    it('skips a slug the model repeated inside one batch', async () => {
      const result = await service.fileBatch(
        outcome({ accepted: [accepted(), accepted()] }),
      );
      expect(result.saved).toHaveLength(1);
      expect(result.skipped).toEqual(['nine']);
    });

    it('normalises whatever slug the model suggested', async () => {
      await service.fileBatch(
        outcome({ accepted: [accepted({ slug: '  The ASTERISK!  ' })] }),
      );
      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'the-asterisk' }),
      );
    });

    /**
     * The reason the rejections table exists. Returned-only rejections cannot
     * show a rate climbing after a Charter edit.
     */
    it('stores a screen rejection with its categories, gate, feedback and round', async () => {
      const result = await service.fileBatch(
        outcome({
          rejected: [
            {
              task: generated({
                slug: 'rooftop',
                brief: 'Film from a rooftop.',
              }),
              source: 'screen',
              round: 1,
              violations: [
                {
                  category: 'heights',
                  matched: 'rooftop',
                  remedy: 'Ground level.',
                },
              ],
              feedback: 'heights ("rooftop"): Ground level.',
            },
          ],
        }),
      );

      expect(result.rejectionsStored).toBe(1);
      expect(rejectionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'rooftop',
          charterHash: 'abc123def456',
          categories: ['heights'],
          source: 'screen',
          feedback: 'heights ("rooftop"): Ground level.',
          round: 1,
          model: 'claude-opus-5',
        }),
      );
    });

    /**
     * The reviewer's refusals are the other half of the evidence. Its
     * categories are the blocked types it named, and the model is the
     * reviewer's, not the creator's.
     */
    it('stores a reviewer rejection under the reviewer model with its blocked types', async () => {
      const review = rejectedByReviewer();
      await service.fileBatch(
        outcome({
          rejected: [
            {
              task: generated({ slug: 'shot', brief: 'Down a shot.' }),
              source: 'reviewer',
              round: 2,
              violations: [],
              feedback: review.feedback as string,
              review,
            },
          ],
        }),
      );

      expect(rejectionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'shot',
          source: 'reviewer',
          round: 2,
          categories: ['substances'],
          model: 'claude-opus-5-reviewer',
          feedback: review.feedback,
          violations: [review],
        }),
      );
    });

    it('files an empty batch without complaining', async () => {
      const result = await service.fileBatch(outcome());
      expect(result).toMatchObject({
        saved: [],
        skipped: [],
        rejectionsStored: 0,
      });
      expect(templateRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    const draft = {
      id: 't1',
      status: 'draft',
      brief: 'Nine things in one room that are exactly the same colour.',
      guards: [],
      criteria: [],
      review: null as TaskReview | null,
    };

    it('is a 404 for a template that is not there', async () => {
      templateRepo.findOne.mockResolvedValue(null);
      await expect(service.approve('t1', APPROVER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('approves a clean draft and records who did it', async () => {
      templateRepo.findOne.mockResolvedValue({ ...draft });
      await service.approve('t1', APPROVER);
      expect(templateRepo.query).toHaveBeenCalledWith(
        expect.stringContaining(`"status" = 'approved'`),
        ['t1', 'u1'],
      );
    });

    /**
     * The property that makes approval meaningful. A template can be edited
     * between generation and approval, and the Charter can move — so the check
     * that counts is against the rules in force now.
     */
    it('re-screens at approval rather than trusting generation time', async () => {
      templateRepo.findOne.mockResolvedValue({
        ...draft,
        brief: 'Climb onto the rooftop and film the skyline.',
      });

      await expect(service.approve('t1', APPROVER)).rejects.toThrow(
        BadRequestException,
      );
      expect(templateRepo.query).not.toHaveBeenCalled();
    });

    it('says which rule refused it', async () => {
      templateRepo.findOne.mockResolvedValue({
        ...draft,
        brief: 'Buy a coffee and photograph the receipt.',
      });
      await expect(service.approve('t1', APPROVER)).rejects.toThrow(/spending/);
    });

    /**
     * The reviewer's no stands. A draft it refused is not approvable by a
     * click; it has to be edited and asked again.
     */
    it('refuses a draft the reviewer rejected, without touching the row', async () => {
      const review = rejectedByReviewer();
      templateRepo.findOne.mockResolvedValue({
        ...draft,
        review: { ...review, round: 1 },
      });

      await expect(service.approve('t1', APPROVER)).rejects.toThrow(
        /reviewer rejected/,
      );
      await expect(service.approve('t1', APPROVER)).rejects.toThrow(
        /substances/,
      );
      expect(templateRepo.query).not.toHaveBeenCalled();
    });

    it('approves a draft the reviewer approved', async () => {
      templateRepo.findOne.mockResolvedValue({ ...draft, review: approved() });
      await service.approve('t1', APPROVER);
      expect(templateRepo.query).toHaveBeenCalled();
    });

    it('approves a hand-written draft nobody has reviewed', async () => {
      templateRepo.findOne.mockResolvedValue({ ...draft, review: null });
      await service.approve('t1', APPROVER);
      expect(templateRepo.query).toHaveBeenCalled();
    });

    it('refuses a template that is already approved', async () => {
      templateRepo.findOne.mockResolvedValue({ ...draft, status: 'approved' });
      await expect(service.approve('t1', APPROVER)).rejects.toThrow(
        ConflictException,
      );
    });

    /** Two reviewers on the same draft: the database picks one. */
    it('refuses when someone else approved it first', async () => {
      templateRepo.findOne.mockResolvedValue({ ...draft });
      templateRepo.query.mockResolvedValue([[], 0]);
      await expect(service.approve('t1', APPROVER)).rejects.toThrow(
        /approved by someone else/,
      );
    });
  });

  describe('get', () => {
    it('returns the template', async () => {
      templateRepo.findOne.mockResolvedValue({ id: 't1', slug: 'nine' });
      expect((await service.get('t1')).slug).toBe('nine');
    });

    it('is a 404 for a template that is not there', async () => {
      templateRepo.findOne.mockResolvedValue(null);
      await expect(service.get('t1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('recordReview', () => {
    /** A review run by hand is round zero — outside the pipeline's loop. */
    it('writes the verdict on the row as round zero', async () => {
      templateRepo.findOne.mockResolvedValue({ id: 't1', review: null });
      const verdict = rejectedByReviewer();

      const result = await service.recordReview('t1', verdict);

      expect(result.review).toEqual({
        verdict: 'reject',
        severity: 'illegal',
        blockedTypes: ['substances'],
        reasons: verdict.reasons,
        feedback: verdict.feedback,
        model: 'claude-opus-5-reviewer',
        reviewedAt: '2026-09-11T10:00:00.000Z',
        round: 0,
      });
      expect(templateRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 't1', review: result.review }),
      );
    });

    it('is a 404 for a template that is not there', async () => {
      templateRepo.findOne.mockResolvedValue(null);
      await expect(
        service.recordReview('t1', rejectedByReviewer()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('playable', () => {
    it('lists approved tasks only, with what a player needs', async () => {
      templateRepo.find.mockResolvedValue([
        {
          id: 't1',
          slug: 'dog-food',
          tier: 1,
          title: 'Dog food',
          brief: 'Eat a spoonful of dog food. Take a video.',
          proof: 'video',
          mode: 'team',
          rewardNerve: 25,
          rewardCoins: 5,
          penaltyCoins: 2,
          clockMinutes: 15,
          guards: [],
          criteria: [],
          rationale: 'operator only',
          charterHash: 'abc',
        },
      ]);

      const tasks = await service.playable();

      expect(templateRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'approved' } }),
      );
      expect(tasks).toEqual([
        expect.objectContaining({
          id: 't1',
          proof: 'video',
          mode: 'team',
          rewardNerve: 25,
          rewardCoins: 5,
          penaltyCoins: 2,
          clockMinutes: 15,
        }),
      ]);
      expect(tasks[0]).not.toHaveProperty('rationale');
      expect(tasks[0]).not.toHaveProperty('charterHash');
    });

    /** Rows from before these columns existed read as solo, unpaid, one-coin. */
    it('reads a row with no mode or economy as solo, nothing, and one coin', async () => {
      templateRepo.find.mockResolvedValue([
        {
          id: 't1',
          slug: 's',
          tier: 1,
          title: 'T',
          brief: 'B',
          proof: 'either',
          mode: null,
          rewardNerve: null,
          rewardCoins: null,
          penaltyCoins: null,
          clockMinutes: 15,
          guards: [],
          criteria: [],
        },
      ]);
      expect((await service.playable())[0]).toMatchObject({
        mode: 'solo',
        rewardNerve: 0,
        rewardCoins: 0,
        penaltyCoins: 1,
      });
    });

    it('clamps a stored penalty into the rule when reading', async () => {
      templateRepo.find.mockResolvedValue([
        {
          id: 't1',
          slug: 's',
          tier: 1,
          title: 'T',
          brief: 'B',
          proof: 'either',
          mode: 'team',
          rewardNerve: 1,
          rewardCoins: 1,
          penaltyCoins: 9,
          clockMinutes: 15,
          guards: [],
          criteria: [],
        },
      ]);
      expect((await service.playable())[0].penaltyCoins).toBe(3);
    });

    it('filters by mode when asked', async () => {
      await service.playable({ mode: 'team' });
      expect(templateRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'approved', mode: 'team' },
        }),
      );
    });

    it('reads a row with no proof as either', async () => {
      templateRepo.find.mockResolvedValue([
        {
          id: 't1',
          slug: 's',
          tier: 1,
          title: 'T',
          brief: 'B',
          proof: null,
          clockMinutes: 15,
          guards: [],
          criteria: [],
        },
      ]);
      expect((await service.playable())[0].proof).toBe('either');
    });

    it('filters by tier when asked', async () => {
      await service.playable({ tier: 2 });
      expect(templateRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'approved', tier: 2 } }),
      );
    });
  });

  describe('retire', () => {
    it('retires rather than deletes', async () => {
      templateRepo.findOne.mockResolvedValue({ id: 't1', status: 'approved' });
      const result = await service.retire('t1');
      expect(result.status).toBe('retired');
      expect(templateRepo.save).toHaveBeenCalled();
    });

    it('is a 404 for a template that is not there', async () => {
      templateRepo.findOne.mockResolvedValue(null);
      await expect(service.retire('t1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('stats', () => {
    /**
     * A rule that never fires is either unnecessary or broken; a rule that
     * fires on most generations means the Charter is not carrying it. Both are
     * decisions, and neither is visible without counting.
     */
    it('counts rejections per category for one Charter', async () => {
      templateRepo.count.mockResolvedValue(18);
      rejectionRepo.find.mockResolvedValue([
        { categories: ['heights', 'stunts'] },
        { categories: ['heights'] },
        { categories: ['spending'] },
      ]);

      const stats = await service.stats('abc123def456');

      expect(stats).toMatchObject({
        charterHash: 'abc123def456',
        generated: 18,
        rejected: 3,
        byCategory: { heights: 2, stunts: 1, spending: 1 },
      });
    });

    it('is empty rather than an error for a Charter nothing ran under', async () => {
      const stats = await service.stats('deadbeefcafe');
      expect(stats).toMatchObject({
        generated: 0,
        rejected: 0,
        byCategory: {},
      });
    });
  });
});

describe('normaliseSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(normaliseSlug('The Long Shadow')).toBe('the-long-shadow');
  });

  it('strips anything that is not a letter or a digit', () => {
    expect(normaliseSlug('Read It Back!! (v2)')).toBe('read-it-back-v2');
  });

  it('never produces leading or trailing hyphens', () => {
    expect(normaliseSlug('  --hello--  ')).toBe('hello');
  });

  /** The model's slug is a suggestion, not an identifier. */
  it('falls back rather than producing an empty slug', () => {
    expect(normaliseSlug('!!!')).toBe('untitled');
    expect(normaliseSlug('')).toBe('untitled');
    expect(normaliseSlug(undefined as unknown as string)).toBe('untitled');
  });

  it('bounds the length to what the column holds', () => {
    expect(normaliseSlug('a'.repeat(500))).toHaveLength(80);
  });
});
