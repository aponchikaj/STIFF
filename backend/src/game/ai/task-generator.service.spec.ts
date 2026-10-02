import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CHARTER, CHARTER_HASH } from './charter';
import {
  TaskGeneratorService,
  type GeneratedTask,
} from './task-generator.service';

/**
 * The model call.
 *
 * The interesting assertions here are not "does it call the API" — they are the
 * three properties that make it safe to point at a live season: the screen runs
 * on everything that comes back, a refusal is handled before the body is read,
 * and the Charter is the entire cached prefix.
 */

const create = jest.fn();

/** The request body the service actually sent, typed so lint can see it. */
interface SentRequest {
  model: string;
  thinking?: unknown;
  system: { text: string; cache_control?: { type: string } }[];
  messages: { role: string; content: string }[];
  output_config: {
    effort: string;
    format: {
      type: string;
      schema: {
        properties: {
          tasks: {
            items: {
              properties: {
                proof: { enum: string[] };
                mode: { enum: string[] };
                rewardNerve: { minimum: number; maximum: number };
                rewardCoins: { minimum: number; maximum: number };
                penaltyCoins: { enum: number[] };
              };
              required: string[];
            };
          };
        };
      };
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

function reply(tasks: Partial<GeneratedTask>[], overrides = {}) {
  return {
    model: 'claude-opus-5',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify({ tasks }) }],
    usage: {
      input_tokens: 120,
      output_tokens: 800,
      cache_read_input_tokens: 4200,
    },
    ...overrides,
  };
}

function task(overrides: Partial<GeneratedTask> = {}): Partial<GeneratedTask> {
  return {
    slug: 'nine',
    tier: 1,
    title: 'Nine',
    brief: 'Nine things in one room that are exactly the same colour.',
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

function serviceWith(env: Record<string, string | undefined>) {
  return new TaskGeneratorService({
    get: (key: string) => env[key],
  } as unknown as ConfigService);
}

describe('TaskGeneratorService', () => {
  beforeEach(() => {
    create.mockReset();
  });

  describe('when there is no API key', () => {
    const service = serviceWith({});

    it('says so rather than pretending', () => {
      expect(service.isConfigured()).toBe(false);
    });

    it('refuses to generate', async () => {
      await expect(service.generate({ tier: 1, count: 3 })).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('the request', () => {
    const service = serviceWith({ ANTHROPIC_API_KEY: 'sk-test' });

    beforeEach(() => {
      create.mockResolvedValue(reply([task()]));
    });

    it('uses the model this repo standardised on', async () => {
      await service.generate({ tier: 1, count: 1 });
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-opus-5' }),
      );
    });

    /**
     * The Charter is large and identical on every call. Caching it is what
     * makes a batch of twenty affordable — and the block has to be the whole
     * prefix, or the cache never hits.
     */
    it('sends the Charter as a single cached system block', async () => {
      await service.generate({ tier: 1, count: 1 });
      expect(sent().system).toHaveLength(1);
      expect(sent().system[0].text).toBe(CHARTER);
      expect(sent().system[0].cache_control).toEqual({ type: 'ephemeral' });
    });

    /**
     * The cache is a prefix match: anything volatile ahead of the Charter
     * invalidates it on every call and silently doubles the bill. The
     * per-request steer belongs in the user turn, after the breakpoint.
     */
    it('keeps the per-call steer out of the cached prefix', async () => {
      await service.generate({
        tier: 2,
        count: 1,
        steer: 'lean on persuasion',
      });
      expect(sent().system[0].text).not.toContain('lean on persuasion');
      expect(sent().messages[0].content).toContain('lean on persuasion');
    });

    it('constrains the reply with a schema rather than parsing prose', async () => {
      await service.generate({ tier: 1, count: 1 });
      expect(sent().output_config.format.type).toBe('json_schema');
    });

    /** `budget_tokens` is removed on this model and would 400. */
    it('asks for adaptive thinking, not a token budget', async () => {
      await service.generate({ tier: 1, count: 1 });
      expect(sent().thinking).toEqual({ type: 'adaptive' });
      expect(sent()).not.toHaveProperty('temperature');
      expect(sent()).not.toHaveProperty('top_p');
    });

    it('tells the model what is already in the pool', async () => {
      await service.generate({ tier: 1, count: 1, avoid: ['heavy', 'nine'] });
      expect(sent().messages[0].content).toContain('heavy, nine');
    });

    it('caps a batch nobody should be asking for', async () => {
      await service.generate({ tier: 1, count: 500 });
      expect(sent().messages[0].content).toContain('Write 20 tier-1 tasks');
    });

    /** Every task says how it is proved, and the schema makes that a field. */
    it('requires a proof mode on every task', async () => {
      await service.generate({ tier: 1, count: 1 });
      const item = sent().output_config.format.schema.properties.tasks.items;
      expect(item.properties.proof.enum).toEqual(['photo', 'video', 'either']);
      expect(item.required).toContain('proof');
    });

    it('asks for the proof mode in the brief too', async () => {
      await service.generate({ tier: 1, count: 1 });
      expect(sent().messages[0].content).toContain('photo, video, or either');
    });

    /**
     * Every task says who it is for and what it pays, and the bounds are in
     * the schema so a model cannot write a task that costs a clan ten coins.
     */
    it('requires a mode and the economy fields, within the rule', async () => {
      await service.generate({ tier: 1, count: 1 });
      const item = sent().output_config.format.schema.properties.tasks.items;
      expect(item.properties.mode.enum).toEqual(['solo', 'team']);
      expect(item.properties.rewardNerve).toMatchObject({
        minimum: 5,
        maximum: 100,
      });
      expect(item.properties.rewardCoins).toMatchObject({
        minimum: 1,
        maximum: 20,
      });
      expect(item.properties.penaltyCoins.enum).toEqual([1, 2, 3]);
      for (const field of [
        'mode',
        'rewardNerve',
        'rewardCoins',
        'penaltyCoins',
      ]) {
        expect(item.required).toContain(field);
      }
    });

    it('asks for team tasks, for a clan of two, when told to', async () => {
      await service.generate({ tier: 2, count: 3, mode: 'team' });
      expect(sent().messages[0].content).toContain(
        'Write 3 tier-2 team tasks, for a clan of two.',
      );
    });

    it('asks for solo tasks when told to', async () => {
      await service.generate({ tier: 1, count: 2, mode: 'solo' });
      expect(sent().messages[0].content).toContain(
        'Write 2 tier-1 solo tasks.',
      );
    });

    it('leaves the mode to the model when not told', async () => {
      await service.generate({ tier: 1, count: 2 });
      expect(sent().messages[0].content).toContain('Write 2 tier-1 tasks.');
    });
  });

  /**
   * The other half of the loop: a task the reviewer or the screen refused
   * goes back with the reason, and the creator writes a different one.
   */
  describe('revise', () => {
    const service = serviceWith({ ANTHROPIC_API_KEY: 'sk-test' });
    const rejected = task({
      slug: 'vodka',
      title: 'Vodka',
      brief: 'Down a shot of vodka on camera.',
    }) as GeneratedTask;

    it('refuses without an API key', async () => {
      await expect(
        serviceWith({}).revise({ tier: 1, rejected, feedback: 'No.' }),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(create).not.toHaveBeenCalled();
    });

    it('sends the rejected task and the reason, and asks for one different task', async () => {
      create.mockResolvedValue(reply([task({ slug: 'kibble' })]));
      await service.revise({
        tier: 2,
        rejected,
        feedback: 'That is alcohol.',
        avoid: ['heavy', 'nine'],
        steer: 'gross-out',
      });
      const content = sent().messages[0].content;
      expect(content).toContain('tier-2');
      expect(content).toContain('title: Vodka');
      expect(content).toContain('brief: Down a shot of vodka on camera.');
      expect(content).toContain('Why: That is alcohol.');
      expect(content).toContain('Write ONE replacement');
      expect(content).toContain('heavy, nine');
      expect(content).toContain('gross-out');
    });

    it('keeps the Charter as the single cached prefix', async () => {
      create.mockResolvedValue(reply([task()]));
      await service.revise({ tier: 1, rejected, feedback: 'No.' });
      expect(sent().system).toHaveLength(1);
      expect(sent().system[0].text).toBe(CHARTER);
      expect(sent().system[0].cache_control).toEqual({ type: 'ephemeral' });
      expect(sent().output_config.format.type).toBe('json_schema');
    });

    it('hands back the replacement with the model and the usage', async () => {
      create.mockResolvedValue(reply([task({ slug: 'kibble' })]));
      const result = await service.revise({
        tier: 1,
        rejected,
        feedback: 'No.',
      });
      expect(result.task?.slug).toBe('kibble');
      expect(result.model).toBe('claude-opus-5');
      expect(result.usage).toEqual({
        inputTokens: 120,
        outputTokens: 800,
        cacheReadTokens: 4200,
      });
    });

    it('hands back nothing on a refusal rather than throwing', async () => {
      create.mockResolvedValue({
        model: 'claude-opus-5',
        stop_reason: 'refusal',
        stop_details: { type: 'refusal', category: 'cyber' },
        content: [],
        usage: { input_tokens: 10, output_tokens: 0 },
      });
      const result = await service.revise({
        tier: 1,
        rejected,
        feedback: 'No.',
      });
      expect(result.task).toBeNull();
      expect(result.usage.inputTokens).toBe(10);
    });

    it('hands back nothing on an unreadable reply', async () => {
      create.mockResolvedValue(
        reply([], { content: [{ type: 'text', text: '{"tasks":[{' }] }),
      );
      const result = await service.revise({
        tier: 1,
        rejected,
        feedback: 'No.',
      });
      expect(result.task).toBeNull();
    });

    /** The screen is the pipeline's job on a revision, not the creator's. */
    it('does not screen the replacement itself', async () => {
      create.mockResolvedValue(
        reply([task({ slug: 'roof', brief: 'Film from a rooftop ledge.' })]),
      );
      const result = await service.revise({
        tier: 1,
        rejected,
        feedback: 'No.',
      });
      expect(result.task?.slug).toBe('roof');
    });
  });

  describe('the screen', () => {
    const service = serviceWith({ ANTHROPIC_API_KEY: 'sk-test' });

    it('accepts a clean task', async () => {
      create.mockResolvedValue(reply([task()]));
      const outcome = await service.generate({ tier: 1, count: 1 });
      expect(outcome.accepted).toHaveLength(1);
      expect(outcome.rejected).toHaveLength(0);
    });

    /**
     * The property the whole module exists for. The Charter is a request; the
     * screen is the decision.
     */
    it('rejects what the model wrote despite the Charter', async () => {
      create.mockResolvedValue(
        reply([
          task(),
          task({
            slug: 'rooftop',
            brief: 'Film yourself on a rooftop ledge over the city.',
          }),
        ]),
      );

      const outcome = await service.generate({ tier: 1, count: 2 });

      expect(outcome.accepted.map((t) => t.slug)).toEqual(['nine']);
      expect(outcome.rejected).toHaveLength(1);
      expect(outcome.rejected[0].violations[0].category).toBe('heights');
    });

    /** Kept, not discarded — it is the signal for the next Charter edit. */
    it('keeps rejections with their reasons', async () => {
      create.mockResolvedValue(
        reply([
          task({ slug: 'buy', brief: 'Buy a coffee and photograph it.' }),
        ]),
      );
      const outcome = await service.generate({ tier: 1, count: 1 });
      expect(outcome.rejected[0].task.slug).toBe('buy');
      expect(outcome.rejected[0].violations[0].remedy).toBeTruthy();
    });

    it('catches a stranger-facing task with no adults_only', async () => {
      create.mockResolvedValue(
        reply([
          task({
            slug: 'phrase',
            brief: 'Ask a stranger to repeat the season phrase.',
            guards: ['consent_on_record'],
          }),
        ]),
      );
      const outcome = await service.generate({ tier: 2, count: 1 });
      expect(outcome.accepted).toHaveLength(0);
      expect(outcome.rejected[0].violations[0].category).toBe('minors');
    });
  });

  describe('what comes back', () => {
    const service = serviceWith({ ANTHROPIC_API_KEY: 'sk-test' });

    /**
     * A refusal is an HTTP 200 with empty or partial content, so it has to be
     * checked before anything reads the body.
     */
    it('handles a refusal rather than reading an empty body', async () => {
      create.mockResolvedValue({
        model: 'claude-opus-5',
        stop_reason: 'refusal',
        stop_details: { type: 'refusal', category: 'cyber' },
        content: [],
        usage: { input_tokens: 10, output_tokens: 0 },
      });

      await expect(service.generate({ tier: 1, count: 1 })).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('survives a truncated reply instead of throwing', async () => {
      create.mockResolvedValue(
        reply([], { content: [{ type: 'text', text: '{"tasks":[{' }] }),
      );
      const outcome = await service.generate({ tier: 1, count: 1 });
      expect(outcome.accepted).toEqual([]);
      expect(outcome.rejected).toEqual([]);
    });

    it('survives a reply with no text block', async () => {
      create.mockResolvedValue(reply([], { content: [] }));
      await expect(
        service.generate({ tier: 1, count: 1 }),
      ).resolves.toMatchObject({ accepted: [] });
    });

    /**
     * Stamped on every batch so a task can be traced to the exact rules that
     * produced it — which is what makes "re-run the corpus on every Charter
     * change" checkable rather than a note in a document.
     */
    it('stamps the Charter hash and the serving model', async () => {
      create.mockResolvedValue(reply([task()]));
      const outcome = await service.generate({ tier: 1, count: 1 });
      expect(outcome.charterHash).toBe(CHARTER_HASH);
      expect(outcome.model).toBe('claude-opus-5');
    });

    it('reports cache reads so the bill can be watched', async () => {
      create.mockResolvedValue(reply([task()]));
      const outcome = await service.generate({ tier: 1, count: 1 });
      expect(outcome.usage.cacheReadTokens).toBe(4200);
    });
  });
});
