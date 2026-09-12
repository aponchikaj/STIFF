import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { GameAttempt } from '../entities/game-attempt.entity';
import { GameTaskTemplate } from '../entities/game-task-template.entity';
import { defaultVoteReward } from '../rules';
import { VoteResolverService } from './vote-resolver.service';

/**
 * The vote resolver.
 *
 * The property that matters: it never throws and never guesses. Anything
 * it cannot judge — no key, a clip, no media, a refusal, an outage, a reply
 * it cannot read — comes back `unsure`, which hands the attempt to a
 * person. The payout is always inside the rule's range whatever the model
 * wrote.
 */

const create = jest.fn();

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: class {
    messages = { create };
  },
}));

interface SentRequest {
  model: string;
  system: { text: string; cache_control?: { type: string } }[];
  messages: {
    role: string;
    content: (
      | { type: 'image'; source: { type: string; url: string } }
      | { type: 'text'; text: string }
    )[];
  }[];
  output_config: { format: { type: string } };
}

function sent(): SentRequest {
  return (create.mock.calls[0] as [SentRequest])[0];
}

function sentText(): string {
  const block = sent().messages[0].content.find((b) => b.type === 'text');
  return block && block.type === 'text' ? block.text : '';
}

function reply(
  body: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  return {
    model: 'claude-sonnet-5',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify(body) }],
    usage: { input_tokens: 10, output_tokens: 20 },
    ...overrides,
  };
}

function attempt(overrides: Partial<GameAttempt> = {}): GameAttempt {
  return {
    id: 'a1',
    enrolmentId: 'e1',
    seasonId: 's1',
    taskTemplateId: 't1',
    day: 2,
    kind: 'photo',
    status: 'submitted',
    mediaUrl: 'https://media.stiff.ge/seasons/zero/day-2/deadbeef.jpg',
    mimeType: 'image/jpeg',
    caption: 'did it',
    aiVerdict: null,
    ...overrides,
  } as GameAttempt;
}

function template(overrides: Partial<GameTaskTemplate> = {}): GameTaskTemplate {
  return {
    id: 't1',
    title: 'Dog food',
    brief: 'Eat a spoonful of dog food on camera. Take a video.',
    proof: 'photo',
    criteria: [
      {
        id: 'c1',
        modality: 'visual',
        required: true,
        assert: 'A spoon is visible',
      },
      { id: 'c2', modality: 'scene', required: false, assert: 'A kitchen' },
    ],
    ...overrides,
  } as GameTaskTemplate;
}

describe('VoteResolverService', () => {
  let service: VoteResolverService;
  let env: Record<string, string | undefined>;

  beforeEach(async () => {
    create.mockReset();
    env = { ANTHROPIC_API_KEY: 'sk-test' };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoteResolverService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => env[key]) },
        },
      ],
    }).compile();

    service = module.get(VoteResolverService);
  });

  const input = (overrides: Partial<GameAttempt> = {}) => ({
    attempt: attempt(overrides),
    template: template(),
    yes: 3,
    no: 1,
  });

  describe('when it cannot look', () => {
    it('is unsure without a key, with the tier default payout', async () => {
      env.ANTHROPIC_API_KEY = undefined;
      const result = await service.resolve(input());
      expect(result.outcome).toBe('unsure');
      expect(result.payout).toBe(defaultVoteReward(2));
      expect(result.reasons[0]).toMatch(/ANTHROPIC_API_KEY/);
      expect(result.model).toBeNull();
      expect(create).not.toHaveBeenCalled();
    });

    it('is unsure for a clip', async () => {
      const result = await service.resolve(input({ kind: 'video' }));
      expect(result.outcome).toBe('unsure');
      expect(result.reasons[0]).toMatch(/Clips/);
      expect(create).not.toHaveBeenCalled();
    });

    it('is unsure with no media', async () => {
      const result = await service.resolve(input({ mediaUrl: null }));
      expect(result.outcome).toBe('unsure');
      expect(create).not.toHaveBeenCalled();
    });

    it('uses the tier default payout for every unsure', async () => {
      env.ANTHROPIC_API_KEY = undefined;
      expect((await service.resolve(input({ day: 1 }))).payout).toBe(2);
      expect((await service.resolve(input({ day: 3 }))).payout).toBe(5);
    });
  });

  describe('the prompt', () => {
    beforeEach(() => {
      create.mockResolvedValue(
        reply({
          outcome: 'confirmed',
          confidence: 0.9,
          payout: 3,
          reasons: ['ok'],
        }),
      );
    });

    it('states the payout range and the unsure option in the cached system block', async () => {
      await service.resolve(input());
      const system = sent().system[0];
      expect(system.text).toContain('2');
      expect(system.text).toContain('5');
      expect(system.text).toMatch(/unsure/);
      expect(system.cache_control).toEqual({ type: 'ephemeral' });
    });

    it('sends the image by URL', async () => {
      await service.resolve(input());
      const image = sent().messages[0].content.find((b) => b.type === 'image');
      expect(image).toEqual({
        type: 'image',
        source: {
          type: 'url',
          url: 'https://media.stiff.ge/seasons/zero/day-2/deadbeef.jpg',
        },
      });
    });

    it('carries the task, the tallies, the caption, the cheat verdict and the day', async () => {
      await service.resolve(
        input({
          aiVerdict: {
            verdict: 'authentic',
            confidence: 0.8,
            reasons: [],
            model: 'm',
            checkedAt: 'x',
            mode: 'enforce',
            enforced: false,
          },
        }),
      );
      const text = sentText();
      expect(text).toContain('Task: Dog food');
      expect(text).toContain('Brief: Eat a spoonful of dog food');
      expect(text).toContain('Proof required: photo');
      expect(text).toContain('[visual, required] A spoon is visible');
      expect(text).toContain('[scene] A kitchen');
      expect(text).toContain('Votes: 3 yes, 1 no');
      expect(text).toContain('Caption: did it');
      expect(text).toContain('Cheat detector: authentic (0.8)');
      expect(text).toContain('Day: 2');
    });

    it('says so when there is no task context', async () => {
      await service.resolve({ ...input(), template: null });
      expect(sentText()).toMatch(/No task context/);
    });

    it('asks for JSON matching the schema', async () => {
      await service.resolve(input());
      expect(sent().output_config.format.type).toBe('json_schema');
    });

    it('uses claude-sonnet-5 by default', async () => {
      await service.resolve(input());
      expect(sent().model).toBe('claude-sonnet-5');
    });

    it('lets GAME_VOTE_RESOLVER_MODEL override the model', async () => {
      env.GAME_VOTE_RESOLVER_MODEL = ' claude-opus-5 ';
      await service.resolve(input());
      expect(sent().model).toBe('claude-opus-5');
    });
  });

  describe('the verdict', () => {
    it('passes a confirmed outcome through with its confidence and reasons', async () => {
      create.mockResolvedValue(
        reply({
          outcome: 'confirmed',
          confidence: 0.92,
          payout: 4,
          reasons: ['Spoon visible', 'Kibble on it'],
        }),
      );
      const result = await service.resolve(input());
      expect(result).toMatchObject({
        outcome: 'confirmed',
        confidence: 0.92,
        payout: 4,
        reasons: ['Spoon visible', 'Kibble on it'],
        model: 'claude-sonnet-5',
      });
    });

    it('passes not_confirmed through', async () => {
      create.mockResolvedValue(
        reply({
          outcome: 'not_confirmed',
          confidence: 0.7,
          payout: 2,
          reasons: ['x'],
        }),
      );
      expect((await service.resolve(input())).outcome).toBe('not_confirmed');
    });

    it('clamps the payout into the rule', async () => {
      create.mockResolvedValue(
        reply({
          outcome: 'confirmed',
          confidence: 0.9,
          payout: 7,
          reasons: [],
        }),
      );
      expect((await service.resolve(input())).payout).toBe(5);

      create.mockResolvedValue(
        reply({
          outcome: 'confirmed',
          confidence: 0.9,
          payout: 1,
          reasons: [],
        }),
      );
      expect((await service.resolve(input())).payout).toBe(2);
    });

    it('clamps the confidence to [0, 1] and reads garbage as 0', async () => {
      create.mockResolvedValue(
        reply({ outcome: 'confirmed', confidence: 4, payout: 3, reasons: [] }),
      );
      expect((await service.resolve(input())).confidence).toBe(1);

      create.mockResolvedValue(
        reply({
          outcome: 'confirmed',
          confidence: 'high',
          payout: 3,
          reasons: [],
        }),
      );
      expect((await service.resolve(input())).confidence).toBe(0);
    });

    it('treats an unknown outcome as unsure', async () => {
      create.mockResolvedValue(
        reply({ outcome: 'maybe', confidence: 0.5, payout: 3, reasons: [] }),
      );
      expect((await service.resolve(input())).outcome).toBe('unsure');
    });

    it('keeps at most five string reasons', async () => {
      create.mockResolvedValue(
        reply({
          outcome: 'confirmed',
          confidence: 0.9,
          payout: 3,
          reasons: ['a', 'b', 'c', 'd', 'e', 'f', 7],
        }),
      );
      expect((await service.resolve(input())).reasons).toEqual([
        'a',
        'b',
        'c',
        'd',
        'e',
      ]);
    });
  });

  describe('when the model fails', () => {
    it('is unsure on a refusal', async () => {
      create.mockResolvedValue(
        reply(
          {},
          {
            stop_reason: 'refusal',
            stop_details: { category: 'x' },
            content: [],
          },
        ),
      );
      const result = await service.resolve(input());
      expect(result.outcome).toBe('unsure');
      expect(result.reasons[0]).toMatch(/declined/);
      expect(result.model).toBe('claude-sonnet-5');
    });

    it('is unsure on an unreadable reply', async () => {
      create.mockResolvedValue(reply({}, { content: [] }));
      const result = await service.resolve(input());
      expect(result.outcome).toBe('unsure');
      expect(result.reasons[0]).toMatch(/could not be read/);
    });

    it('is unsure on invalid JSON', async () => {
      create.mockResolvedValue(
        reply({}, { content: [{ type: 'text', text: '{not json' }] }),
      );
      const result = await service.resolve(input());
      expect(result.outcome).toBe('unsure');
      expect(result.reasons[0]).toMatch(/failed/);
    });

    it('is unsure, and never throws, when the API throws', async () => {
      create.mockRejectedValue(new Error('socket hang up'));
      const result = await service.resolve(input());
      expect(result.outcome).toBe('unsure');
      expect(result.reasons[0]).toMatch(/socket hang up/);
      expect(result.payout).toBe(defaultVoteReward(2));
    });
  });
});
