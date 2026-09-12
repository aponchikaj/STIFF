import { ConfigService } from '@nestjs/config';
import { BLOCKED_TYPE_IDS, renderBlocklist } from './blocklist';
import type { GeneratedTask } from './task-generator.service';
import { TaskReviewerService } from './task-reviewer.service';

/**
 * The second agent.
 *
 * The property that matters is that it fails closed: anything that is not a
 * clear approval from a working model is a rejection with the reason on it.
 * A task nobody reviewed must never read as a task that passed.
 */

const create = jest.fn();

interface SentRequest {
  model: string;
  thinking?: unknown;
  system: { text: string; cache_control?: { type: string } }[];
  messages: { role: string; content: string }[];
  output_config: {
    effort: string;
    format: {
      type: string;
      schema: { properties: { blockedTypes: { items: { enum: string[] } } } };
    };
  };
}

function sent(): SentRequest {
  return (create.mock.calls[0] as [SentRequest])[0];
}

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: class {
    messages = { create };
  },
}));

function reply(body: unknown, overrides = {}) {
  return {
    model: 'claude-opus-5',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify(body) }],
    usage: { input_tokens: 50, output_tokens: 80 },
    ...overrides,
  };
}

function task(
  overrides: Partial<GeneratedTask> = {},
): Pick<
  GeneratedTask,
  'title' | 'brief' | 'tier' | 'proof' | 'guards' | 'criteria'
> {
  return {
    title: 'Kibble',
    brief: 'Eat a spoonful of dog food on camera. Take a video.',
    tier: 1,
    proof: 'video',
    guards: ['own_wardrobe'],
    criteria: [
      {
        id: 'c1',
        modality: 'visual',
        required: true,
        assert: 'A spoonful is eaten.',
      },
    ],
    ...overrides,
  };
}

function serviceWith(env: Record<string, string | undefined>) {
  return new TaskReviewerService({
    get: (key: string) => env[key],
  } as unknown as ConfigService);
}

describe('TaskReviewerService', () => {
  beforeEach(() => {
    create.mockReset();
  });

  describe('without an API key', () => {
    const service = serviceWith({});

    it('says it is not configured', () => {
      expect(service.isConfigured()).toBe(false);
    });

    /** Fail closed: nothing is reviewed, so nothing passes. */
    it('rejects rather than passes, and never calls the model', async () => {
      const verdict = await service.review(task());
      expect(verdict.verdict).toBe('reject');
      expect(verdict.feedback).toContain('ANTHROPIC_API_KEY');
      expect(verdict.model).toBeNull();
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('the request', () => {
    const service = serviceWith({ ANTHROPIC_API_KEY: 'sk-test' });

    beforeEach(() => {
      create.mockResolvedValue(
        reply({
          verdict: 'approve',
          severity: 'ok',
          blockedTypes: [],
          reasons: ['Harmless and provable.'],
          feedback: '',
        }),
      );
    });

    it('defaults to the strict model', async () => {
      await service.review(task());
      expect(sent().model).toBe('claude-opus-5');
    });

    it('lets the environment pick the model', async () => {
      const other = serviceWith({
        ANTHROPIC_API_KEY: 'sk-test',
        GAME_TASK_REVIEWER_MODEL: ' claude-sonnet-5 ',
      });
      await other.review(task());
      expect(sent().model).toBe('claude-sonnet-5');
    });

    /** The same rulebook the creator was given, and the word that matters. */
    it('puts the rendered blocklist in a cached, strict system prompt', async () => {
      await service.review(task());
      expect(sent().system).toHaveLength(1);
      expect(sent().system[0].text).toContain(renderBlocklist());
      expect(sent().system[0].text).toMatch(/strict/i);
      expect(sent().system[0].cache_control).toEqual({ type: 'ephemeral' });
    });

    it('sends the whole task in the user turn', async () => {
      await service.review(task());
      const content = sent().messages[0].content;
      expect(content).toContain('Title: Kibble');
      expect(content).toContain('Brief: Eat a spoonful of dog food');
      expect(content).toContain('Proof: video');
      expect(content).toContain('Guards: own_wardrobe');
      expect(content).toContain('[visual, required] A spoonful is eaten.');
      expect(content).toContain('Tier: 1');
    });

    it('constrains the reply to a schema that enumerates the blocked types', async () => {
      await service.review(task());
      expect(sent().output_config.format.type).toBe('json_schema');
      expect(
        sent().output_config.format.schema.properties.blockedTypes.items.enum,
      ).toEqual([...BLOCKED_TYPE_IDS]);
      expect(sent().thinking).toEqual({ type: 'adaptive' });
    });
  });

  describe('the verdict', () => {
    const service = serviceWith({ ANTHROPIC_API_KEY: 'sk-test' });

    it('passes an approval through with no feedback', async () => {
      create.mockResolvedValue(
        reply({
          verdict: 'approve',
          severity: 'ok',
          blockedTypes: [],
          reasons: ['Fine.'],
          feedback: '',
        }),
      );
      const verdict = await service.review(task());
      expect(verdict).toMatchObject({
        verdict: 'approve',
        severity: 'ok',
        blockedTypes: [],
        reasons: ['Fine.'],
        feedback: null,
        model: 'claude-opus-5',
      });
      expect(Number.isNaN(Date.parse(verdict.reviewedAt))).toBe(false);
    });

    it('passes a rejection through with its blocked types and feedback', async () => {
      create.mockResolvedValue(
        reply({
          verdict: 'reject',
          severity: 'illegal',
          blockedTypes: ['substances', 'gambling'],
          reasons: ['A shot of vodka.'],
          feedback:
            'That is alcohol. Write a gross-out dare with food instead.',
        }),
      );
      const verdict = await service.review(task());
      expect(verdict).toMatchObject({
        verdict: 'reject',
        severity: 'illegal',
        blockedTypes: ['substances', 'gambling'],
        feedback: 'That is alcohol. Write a gross-out dare with food instead.',
      });
    });

    /** Naming a blocked type is a rejection, whatever the flag said. */
    it('coerces an approval that names a blocked type into a rejection', async () => {
      create.mockResolvedValue(
        reply({
          verdict: 'approve',
          severity: 'ok',
          blockedTypes: ['weapons'],
          reasons: ['Has a knife in it, but only for show.'],
          feedback: '',
        }),
      );
      const verdict = await service.review(task());
      expect(verdict.verdict).toBe('reject');
      expect(verdict.blockedTypes).toEqual(['weapons']);
      expect(verdict.severity).toBe('bad');
      expect(verdict.feedback).toBe('Has a knife in it, but only for show.');
    });

    it('drops blocked type ids it does not know', async () => {
      create.mockResolvedValue(
        reply({
          verdict: 'reject',
          severity: 'bad',
          blockedTypes: ['made_up', 'theft', 42],
          reasons: [],
          feedback: 'No.',
        }),
      );
      const verdict = await service.review(task());
      expect(verdict.blockedTypes).toEqual(['theft']);
    });

    it('keeps illegal only on a rejection and flattens the rest to bad', async () => {
      create.mockResolvedValue(
        reply({
          verdict: 'reject',
          severity: 'ok',
          blockedTypes: [],
          reasons: ['Cruel.'],
          feedback: 'Too cruel.',
        }),
      );
      expect((await service.review(task())).severity).toBe('bad');

      create.mockReset();
      create.mockResolvedValue(
        reply({
          verdict: 'approve',
          severity: 'illegal',
          blockedTypes: [],
          reasons: [],
          feedback: '',
        }),
      );
      expect((await service.review(task())).severity).toBe('ok');
    });

    it('falls back to the first reason when a rejection has no feedback', async () => {
      create.mockResolvedValue(
        reply({
          verdict: 'reject',
          severity: 'bad',
          blockedTypes: [],
          reasons: ['Cannot be proved from footage.'],
          feedback: '   ',
        }),
      );
      const verdict = await service.review(task());
      expect(verdict.feedback).toBe('Cannot be proved from footage.');
    });
  });

  describe('failing closed', () => {
    const service = serviceWith({ ANTHROPIC_API_KEY: 'sk-test' });

    it('treats a refusal as a rejection', async () => {
      create.mockResolvedValue({
        model: 'claude-opus-5',
        stop_reason: 'refusal',
        stop_details: { type: 'refusal', category: 'cyber' },
        content: [],
        usage: { input_tokens: 10, output_tokens: 0 },
      });
      const verdict = await service.review(task());
      expect(verdict.verdict).toBe('reject');
      expect(verdict.feedback).toMatch(/declined/);
      expect(verdict.model).toBe('claude-opus-5');
    });

    it('treats an unreadable reply as a rejection', async () => {
      create.mockResolvedValue(
        reply(null, { content: [{ type: 'text', text: '{"verdict":' }] }),
      );
      const verdict = await service.review(task());
      expect(verdict.verdict).toBe('reject');
      expect(verdict.feedback).toMatch(/could not be read/);
    });

    it('treats a reply with an unknown verdict as a rejection', async () => {
      create.mockResolvedValue(reply({ verdict: 'maybe' }));
      expect((await service.review(task())).verdict).toBe('reject');
    });

    it('treats a thrown API error as a rejection rather than throwing', async () => {
      create.mockRejectedValue(new Error('connection reset'));
      const verdict = await service.review(task());
      expect(verdict.verdict).toBe('reject');
      expect(verdict.feedback).toContain('connection reset');
      expect(verdict.model).toBeNull();
    });
  });
});
