import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../users/user.entity';
import type { GenerationOutcome } from './ai/task-generator.service';
import { GameGenerationRejection } from './entities/game-generation-rejection.entity';
import { GameTaskTemplate } from './entities/game-task-template.entity';
import { TaskTemplatesService, normaliseSlug } from './task-templates.service';

/**
 * The task pool.
 *
 * Two properties carry the weight: a generated task lands as a draft and only
 * a person approves it, and the safety screen runs again *at approval* rather
 * than being trusted from generation time.
 */

const APPROVER = { id: 'u1', username: 'boss', role: 'admin' } as User;

function outcome(
  overrides: Partial<GenerationOutcome> = {},
): GenerationOutcome {
  return {
    accepted: [],
    rejected: [],
    charterHash: 'abc123def456',
    model: 'claude-opus-5',
    usage: { inputTokens: 100, outputTokens: 900, cacheReadTokens: 4000 },
    ...overrides,
  };
}

function generated(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'nine',
    tier: 1 as const,
    title: 'Nine',
    brief: 'Nine things in one room that are exactly the same colour.',
    clockMinutes: 15,
    guards: [],
    criteria: [
      { id: 'c1', modality: 'visual', required: true, assert: 'Nine objects.' },
    ],
    rationale: 'Observation, indoors.',
    ...overrides,
  } as GenerationOutcome['accepted'][number];
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
      await service.fileBatch(outcome({ accepted: [generated()] }));
      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'draft', origin: 'generated' }),
      );
    });

    it('never files a generated task as approved', async () => {
      await service.fileBatch(
        outcome({ accepted: [generated(), generated({ slug: 'heavy' })] }),
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
    it('stamps the Charter and the model on every draft', async () => {
      await service.fileBatch(outcome({ accepted: [generated()] }));
      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          charterHash: 'abc123def456',
          model: 'claude-opus-5',
        }),
      );
    });

    /**
     * A model told to avoid the pool still lands on a taken name sometimes.
     * Losing the other nineteen over it is the worse outcome.
     */
    it('skips a slug already in the pool without failing the batch', async () => {
      templateRepo.find.mockResolvedValue([{ slug: 'nine' }]);

      const result = await service.fileBatch(
        outcome({ accepted: [generated(), generated({ slug: 'heavy' })] }),
      );

      expect(result.skipped).toEqual(['nine']);
      expect(result.saved).toHaveLength(1);
      expect(result.saved[0].slug).toBe('heavy');
    });

    /** The database would only catch this as a failed insert. */
    it('skips a slug the model repeated inside one batch', async () => {
      const result = await service.fileBatch(
        outcome({ accepted: [generated(), generated()] }),
      );
      expect(result.saved).toHaveLength(1);
      expect(result.skipped).toEqual(['nine']);
    });

    it('normalises whatever slug the model suggested', async () => {
      await service.fileBatch(
        outcome({ accepted: [generated({ slug: '  The ASTERISK!  ' })] }),
      );
      expect(templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'the-asterisk' }),
      );
    });

    /**
     * The reason the rejections table exists. Returned-only rejections cannot
     * show a rate climbing after a Charter edit.
     */
    it('stores every rejection with its categories', async () => {
      const result = await service.fileBatch(
        outcome({
          rejected: [
            {
              task: generated({
                slug: 'rooftop',
                brief: 'Film from a rooftop.',
              }),
              violations: [
                {
                  category: 'heights',
                  matched: 'rooftop',
                  remedy: 'Ground level.',
                },
              ],
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
