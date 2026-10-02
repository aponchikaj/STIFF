import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { CHARTER_HASH } from './charter';
import { screen } from './exclusions';
import {
  TaskGeneratorService,
  type GeneratedTask,
  type GenerationOutcome,
} from './task-generator.service';
import { feedbackFrom, TaskPipelineService } from './task-pipeline.service';
import {
  TaskReviewerService,
  type ReviewVerdict,
} from './task-reviewer.service';

/**
 * The loop between the two agents.
 *
 * Neither model is real here. What is under test is the choreography: the
 * screen runs before the reviewer, a refusal from either goes back to the
 * creator with the reason, every refusal is kept with its round, and a slot
 * that never produces an acceptable task is dropped rather than filled.
 */

function clean(overrides: Partial<GeneratedTask> = {}): GeneratedTask {
  return {
    slug: 'kibble',
    tier: 1,
    title: 'Kibble',
    brief: 'Eat a spoonful of dog food on camera. Take a video.',
    proof: 'video',
    mode: 'solo',
    rewardNerve: 10,
    rewardCoins: 2,
    penaltyCoins: 1,
    clockMinutes: 15,
    guards: [],
    criteria: [
      {
        id: 'c1',
        modality: 'visual',
        required: true,
        assert: 'A spoonful of dog food is eaten.',
      },
    ],
    rationale: 'Gross, harmless, provable.',
    ...overrides,
  };
}

function dirty(overrides: Partial<GeneratedTask> = {}): GeneratedTask {
  return clean({
    slug: 'vodka',
    title: 'Vodka',
    brief: 'Down a shot of vodka on camera. Take a video.',
    ...overrides,
  });
}

const usage = { inputTokens: 100, outputTokens: 50, cacheReadTokens: 10 };

function batch(
  accepted: GeneratedTask[],
  rejectedTasks: GeneratedTask[] = [],
): GenerationOutcome {
  return {
    accepted,
    rejected: rejectedTasks.map((task) => {
      const result = screen(task);
      return { task, violations: result.ok ? [] : result.violations };
    }),
    charterHash: CHARTER_HASH,
    model: 'creator-model',
    usage: { ...usage },
  };
}

interface ReviseCall {
  tier: number;
  rejected: GeneratedTask;
  feedback: string;
  avoid?: string[];
  steer?: string;
}

/** The n-th `revise` request, typed so lint can see it. */
function revised(calls: jest.Mock, n = 0): ReviseCall {
  return (calls.mock.calls[n] as [ReviseCall])[0];
}

function approve(overrides: Partial<ReviewVerdict> = {}): ReviewVerdict {
  return {
    verdict: 'approve',
    severity: 'ok',
    blockedTypes: [],
    reasons: ['Harmless.'],
    feedback: null,
    model: 'reviewer-model',
    reviewedAt: '2026-09-11T10:00:00.000Z',
    ...overrides,
  };
}

function reject(overrides: Partial<ReviewVerdict> = {}): ReviewVerdict {
  return approve({
    verdict: 'reject',
    severity: 'bad',
    reasons: ['Too cruel.'],
    feedback: 'Too cruel. Write a gross-out dare instead.',
    ...overrides,
  });
}

describe('TaskPipelineService', () => {
  let service: TaskPipelineService;
  let creator: { generate: jest.Mock; revise: jest.Mock };
  let reviewer: { review: jest.Mock };
  let env: Record<string, string | undefined>;

  beforeEach(async () => {
    env = {};
    creator = {
      generate: jest.fn(),
      revise: jest.fn(),
    };
    reviewer = { review: jest.fn().mockResolvedValue(approve()) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskPipelineService,
        { provide: TaskGeneratorService, useValue: creator },
        { provide: TaskReviewerService, useValue: reviewer },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => env[key] },
        },
      ],
    }).compile();

    service = module.get(TaskPipelineService);
  });

  /** Sanity: the fixtures are what the tests say they are. */
  it('uses a clean fixture and a dirty one', () => {
    expect(screen(clean()).ok).toBe(true);
    expect(screen(dirty()).ok).toBe(false);
  });

  describe('maxRounds', () => {
    it('defaults to three', () => {
      expect(service.maxRounds()).toBe(3);
    });

    it('honours the environment within range', () => {
      env.GAME_TASK_MAX_ROUNDS = '5';
      expect(service.maxRounds()).toBe(5);
    });

    it('ignores garbage and out-of-range values', () => {
      env.GAME_TASK_MAX_ROUNDS = 'lots';
      expect(service.maxRounds()).toBe(3);
      env.GAME_TASK_MAX_ROUNDS = '0';
      expect(service.maxRounds()).toBe(3);
      env.GAME_TASK_MAX_ROUNDS = '11';
      expect(service.maxRounds()).toBe(3);
    });
  });

  describe('a clean batch', () => {
    it('accepts everything on round one with the review attached', async () => {
      creator.generate.mockResolvedValue(
        batch([clean(), clean({ slug: 'socks', title: 'Socks' })]),
      );

      const outcome = await service.run({ tier: 1, count: 2 });

      expect(outcome.accepted.map((a) => a.task.slug)).toEqual([
        'kibble',
        'socks',
      ]);
      expect(outcome.accepted[0].review).toMatchObject({
        verdict: 'approve',
        severity: 'ok',
        round: 1,
        model: 'reviewer-model',
        reviewedAt: '2026-09-11T10:00:00.000Z',
      });
      expect(outcome.rejected).toEqual([]);
      expect(outcome.dropped).toBe(0);
      expect(outcome.rounds).toBe(1);
      expect(creator.revise).not.toHaveBeenCalled();
      expect(reviewer.review).toHaveBeenCalledTimes(2);
    });

    it('stamps the Charter hash and both models', async () => {
      creator.generate.mockResolvedValue(batch([clean()]));
      const outcome = await service.run({ tier: 1, count: 1 });
      expect(outcome.charterHash).toBe(CHARTER_HASH);
      expect(outcome.models).toEqual({
        creator: 'creator-model',
        reviewer: 'reviewer-model',
      });
      expect(outcome.maxRounds).toBe(3);
    });

    it('passes the batch options to the creator', async () => {
      creator.generate.mockResolvedValue(batch([clean()]));
      await service.run({ tier: 2, count: 4, avoid: ['old'], steer: 'gross' });
      expect(creator.generate).toHaveBeenCalledWith({
        tier: 2,
        count: 4,
        avoid: ['old'],
        steer: 'gross',
      });
    });

    /** A batch asked for team tasks is a batch asked for team tasks. */
    it('forwards the mode to the creator', async () => {
      creator.generate.mockResolvedValue(batch([clean()]));
      await service.run({ tier: 1, count: 2, mode: 'team' });
      expect(creator.generate).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'team' }),
      );
    });
  });

  describe('a task the screen refused inside the batch', () => {
    it('records a round-one screen rejection and asks for a replacement', async () => {
      creator.generate.mockResolvedValue(batch([], [dirty()]));
      creator.revise.mockResolvedValue({
        task: clean(),
        model: 'creator-model',
        usage: { ...usage },
      });

      const outcome = await service.run({ tier: 1, count: 1 });

      expect(outcome.rejected).toHaveLength(1);
      expect(outcome.rejected[0]).toMatchObject({ source: 'screen', round: 1 });
      expect(outcome.rejected[0].task.slug).toBe('vodka');
      expect(outcome.rejected[0].violations[0].category).toBe('substances');
      expect(outcome.rejected[0].feedback).toContain('substances');

      const call = revised(creator.revise);
      expect(call.tier).toBe(1);
      expect(call.rejected.slug).toBe('vodka');
      expect(call.feedback).toBe(outcome.rejected[0].feedback);
      expect(outcome.accepted).toHaveLength(1);
      expect(outcome.accepted[0].review.round).toBe(2);
      expect(outcome.rounds).toBe(2);
      expect(outcome.dropped).toBe(0);
    });
  });

  describe('a task the reviewer refused', () => {
    it('records the reviewer rejection with its verdict and sends the feedback back', async () => {
      creator.generate.mockResolvedValue(batch([clean()]));
      reviewer.review
        .mockResolvedValueOnce(reject())
        .mockResolvedValueOnce(approve());
      creator.revise.mockResolvedValue({
        task: clean({ slug: 'onion', title: 'Onion' }),
        model: 'creator-model',
        usage: { ...usage },
      });

      const outcome = await service.run({ tier: 1, count: 1 });

      expect(outcome.rejected).toHaveLength(1);
      expect(outcome.rejected[0]).toMatchObject({
        source: 'reviewer',
        round: 1,
        violations: [],
        feedback: 'Too cruel. Write a gross-out dare instead.',
      });
      expect(outcome.rejected[0].task.slug).toBe('kibble');
      expect(outcome.rejected[0].review?.verdict).toBe('reject');
      const call = revised(creator.revise);
      expect(call.rejected.slug).toBe('kibble');
      expect(call.feedback).toBe('Too cruel. Write a gross-out dare instead.');
      expect(outcome.accepted.map((a) => a.task.slug)).toEqual(['onion']);
      expect(outcome.accepted[0].review.round).toBe(2);
    });

    it('uses the reasons when a rejection carries no feedback', async () => {
      creator.generate.mockResolvedValue(batch([clean()]));
      reviewer.review
        .mockResolvedValueOnce(
          reject({ feedback: null, reasons: ['A.', 'B.'] }),
        )
        .mockResolvedValueOnce(approve());
      creator.revise.mockResolvedValue({
        task: clean({ slug: 'onion' }),
        model: 'creator-model',
        usage: { ...usage },
      });

      const outcome = await service.run({ tier: 1, count: 1 });
      expect(outcome.rejected[0].feedback).toBe('A. B.');
    });
  });

  describe('a revision the screen refused', () => {
    it('records it on the right round and revises again', async () => {
      creator.generate.mockResolvedValue(batch([clean()]));
      reviewer.review
        .mockResolvedValueOnce(reject())
        .mockResolvedValueOnce(approve());
      creator.revise
        .mockResolvedValueOnce({
          task: dirty(),
          model: 'creator-model',
          usage: { ...usage },
        })
        .mockResolvedValueOnce({
          task: clean({ slug: 'onion' }),
          model: 'creator-model',
          usage: { ...usage },
        });

      const outcome = await service.run({ tier: 1, count: 1 });

      expect(outcome.rejected.map((r) => [r.source, r.round])).toEqual([
        ['reviewer', 1],
        ['screen', 2],
      ]);
      expect(creator.revise).toHaveBeenCalledTimes(2);
      expect(revised(creator.revise, 1).rejected.slug).toBe('vodka');
      expect(revised(creator.revise, 1).feedback).toContain('substances');
      // The screen never sent the dirty revision to the reviewer.
      expect(reviewer.review).toHaveBeenCalledTimes(2);
      expect(outcome.accepted.map((a) => a.task.slug)).toEqual(['onion']);
      expect(outcome.accepted[0].review.round).toBe(3);
      expect(outcome.rounds).toBe(3);
    });
  });

  describe('running out of rounds', () => {
    it('drops a slot after maxRounds refusals rather than filling it', async () => {
      creator.generate.mockResolvedValue(batch([clean()]));
      reviewer.review.mockResolvedValue(reject());
      creator.revise.mockResolvedValue({
        task: clean({ slug: 'again' }),
        model: 'creator-model',
        usage: { ...usage },
      });

      const outcome = await service.run({ tier: 1, count: 1 });

      expect(outcome.accepted).toEqual([]);
      expect(outcome.dropped).toBe(1);
      expect(reviewer.review).toHaveBeenCalledTimes(3);
      expect(creator.revise).toHaveBeenCalledTimes(2);
      expect(outcome.rejected.map((r) => r.round)).toEqual([1, 2, 3]);
      expect(outcome.rounds).toBe(3);
    });

    it('honours a smaller GAME_TASK_MAX_ROUNDS', async () => {
      env.GAME_TASK_MAX_ROUNDS = '1';
      creator.generate.mockResolvedValue(batch([clean()]));
      reviewer.review.mockResolvedValue(reject());

      const outcome = await service.run({ tier: 1, count: 1 });

      expect(creator.revise).not.toHaveBeenCalled();
      expect(outcome.dropped).toBe(1);
      expect(outcome.maxRounds).toBe(1);
    });

    it('drops a slot the creator could not replace', async () => {
      creator.generate.mockResolvedValue(batch([], [dirty()]));
      creator.revise.mockResolvedValue({
        task: null,
        model: 'creator-model',
        usage: { ...usage },
      });

      const outcome = await service.run({ tier: 1, count: 1 });

      expect(outcome.accepted).toEqual([]);
      expect(outcome.dropped).toBe(1);
      expect(creator.revise).toHaveBeenCalledTimes(1);
      expect(reviewer.review).not.toHaveBeenCalled();
    });

    it('does not count an accepted slot as dropped', async () => {
      creator.generate.mockResolvedValue(batch([clean()], [dirty()]));
      creator.revise.mockResolvedValue({
        task: null,
        model: 'creator-model',
        usage: { ...usage },
      });

      const outcome = await service.run({ tier: 1, count: 2 });
      expect(outcome.accepted).toHaveLength(1);
      expect(outcome.dropped).toBe(1);
    });
  });

  describe('bookkeeping', () => {
    it('tells the creator to avoid the pool and what the batch already accepted', async () => {
      creator.generate.mockResolvedValue(batch([clean()], [dirty()]));
      creator.revise.mockResolvedValue({
        task: clean({ slug: 'onion' }),
        model: 'creator-model',
        usage: { ...usage },
      });

      await service.run({ tier: 1, count: 2, avoid: ['old'], steer: 'gross' });

      expect(revised(creator.revise).avoid).toEqual(['old', 'kibble']);
      expect(revised(creator.revise).steer).toBe('gross');
    });

    it('sums usage across the batch and every revision', async () => {
      creator.generate.mockResolvedValue(batch([clean()]));
      reviewer.review
        .mockResolvedValueOnce(reject())
        .mockResolvedValueOnce(approve());
      creator.revise.mockResolvedValue({
        task: clean({ slug: 'onion' }),
        model: 'creator-model',
        usage: { inputTokens: 7, outputTokens: 3, cacheReadTokens: 1 },
      });

      const outcome = await service.run({ tier: 1, count: 1 });
      expect(outcome.usage).toEqual({
        inputTokens: 107,
        outputTokens: 53,
        cacheReadTokens: 11,
      });
    });

    it('reports the reviewer model from the verdicts', async () => {
      creator.generate.mockResolvedValue(batch([clean()]));
      reviewer.review.mockResolvedValue(approve({ model: 'other-reviewer' }));
      const outcome = await service.run({ tier: 1, count: 1 });
      expect(outcome.models.reviewer).toBe('other-reviewer');
    });

    it('reports no reviewer model when nothing reached the reviewer', async () => {
      creator.generate.mockResolvedValue(batch([]));
      const outcome = await service.run({ tier: 1, count: 1 });
      expect(outcome.models.reviewer).toBeNull();
      expect(outcome.accepted).toEqual([]);
    });
  });

  describe('feedbackFrom', () => {
    it('names the category, the phrase and the remedy for each violation', () => {
      const text = feedbackFrom([
        { category: 'substances', matched: 'vodka', remedy: 'Remove it.' },
        { category: 'fire', matched: 'lighter', remedy: 'No flame.' },
      ]);
      expect(text).toBe(
        'substances ("vodka"): Remove it. fire ("lighter"): No flame.',
      );
    });
  });
});
