import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DisciplineService } from '../discipline.service';
import { GameAttempt } from '../entities/game-attempt.entity';
import { GameTaskTemplate } from '../entities/game-task-template.entity';
import { CheatDetectorService } from './cheat-detector.service';

/**
 * The cheat detector.
 *
 * The properties that make it safe to point at a live season: the model is
 * only asked about a still that is still in play, whatever it says is written
 * on the row, and nothing moves on its word unless the mode says enforce and
 * the confidence clears the bar. Everything else — a refusal, an outage, a
 * clip — ends up as an `unchecked` verdict a person can see, never as silence.
 */

const create = jest.fn();

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: class {
    messages = { create };
  },
}));

/** The request body the service actually sent, typed so lint can see it. */
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
    taskTemplateId: null,
    day: 1,
    kind: 'photo',
    status: 'submitted',
    mediaUrl: 'https://media.stiff.ge/seasons/zero/day-1/deadbeef.jpg',
    mimeType: 'image/jpeg',
    width: 1080,
    height: 1920,
    caption: 'done',
    ...overrides,
  } as GameAttempt;
}

describe('CheatDetectorService', () => {
  let service: CheatDetectorService;
  let attemptRepo: { findOne: jest.Mock; query: jest.Mock };
  let templateRepo: { findOne: jest.Mock };
  let discipline: { flagCheater: jest.Mock };
  let env: Record<string, string | undefined>;

  beforeEach(async () => {
    create.mockReset();
    env = { ANTHROPIC_API_KEY: 'sk-test' };

    attemptRepo = {
      findOne: jest.fn().mockResolvedValue(attempt()),
      // The verdict write is conditional on `submitted`; a returned row is
      // the database saying the attempt was still in play.
      query: jest.fn().mockResolvedValue([{ id: 'a1' }]),
    };
    templateRepo = { findOne: jest.fn().mockResolvedValue(null) };
    discipline = { flagCheater: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheatDetectorService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => env[key]) },
        },
        { provide: getRepositoryToken(GameAttempt), useValue: attemptRepo },
        {
          provide: getRepositoryToken(GameTaskTemplate),
          useValue: templateRepo,
        },
        { provide: DisciplineService, useValue: discipline },
      ],
    }).compile();

    service = module.get(CheatDetectorService);
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
  });

  /** What was written to the row, decoded. */
  function stored(): Record<string, unknown> {
    const [sql, params] = attemptRepo.query.mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(sql).toMatch(/UPDATE "game_attempts"/);
    return JSON.parse(params[1] as string) as Record<string, unknown>;
  }

  describe('when the model is not asked', () => {
    it('records off mode as unchecked and never calls the API', async () => {
      env.GAME_CHEAT_DETECTION = 'off';
      const verdict = await service.inspect('a1');
      expect(verdict).toMatchObject({
        verdict: 'unchecked',
        skipped: 'disabled',
        enforced: false,
        mode: 'off',
      });
      expect(create).not.toHaveBeenCalled();
      expect(stored()).toMatchObject({ skipped: 'disabled' });
    });

    it('records a missing key as unchecked', async () => {
      env.ANTHROPIC_API_KEY = undefined;
      const verdict = await service.inspect('a1');
      expect(verdict).toMatchObject({
        verdict: 'unchecked',
        skipped: 'not_configured',
      });
      expect(create).not.toHaveBeenCalled();
    });

    /** A clip's first frame is not the clip. A person watches it. */
    it('leaves a clip for a person', async () => {
      attemptRepo.findOne.mockResolvedValue(attempt({ kind: 'video' }));
      const verdict = await service.inspect('a1');
      expect(verdict).toMatchObject({ verdict: 'unchecked', skipped: 'video' });
      expect(create).not.toHaveBeenCalled();
      expect(discipline.flagCheater).not.toHaveBeenCalled();
    });

    it('records a missing media URL rather than guessing', async () => {
      attemptRepo.findOne.mockResolvedValue(attempt({ mediaUrl: null }));
      const verdict = await service.inspect('a1');
      expect(verdict).toMatchObject({
        verdict: 'unchecked',
        skipped: 'no_media',
      });
      expect(create).not.toHaveBeenCalled();
    });

    /** A reviewer's verdict stands. The model never second-guesses it. */
    it('returns null for an attempt a person already settled', async () => {
      attemptRepo.findOne.mockResolvedValue(attempt({ status: 'published' }));
      expect(await service.inspect('a1')).toBeNull();
      expect(create).not.toHaveBeenCalled();
      expect(attemptRepo.query).not.toHaveBeenCalled();
    });

    it('returns null for an attempt that does not exist', async () => {
      attemptRepo.findOne.mockResolvedValue(null);
      expect(await service.inspect('missing')).toBeNull();
    });
  });

  describe('the request', () => {
    beforeEach(() => {
      create.mockResolvedValue(
        reply({
          verdict: 'authentic',
          confidence: 0.9,
          reasons: ['A phone photo.'],
          signals: [],
        }),
      );
    });

    it('sends the image by URL with the details beside it', async () => {
      await service.inspect('a1');
      const content = sent().messages[0].content;
      expect(content[0]).toEqual({
        type: 'image',
        source: {
          type: 'url',
          url: 'https://media.stiff.ge/seasons/zero/day-1/deadbeef.jpg',
        },
      });
      expect(sentText()).toContain('Caption: done');
      expect(sentText()).toContain('Day: 1');
      expect(sentText()).toContain('image/jpeg');
      expect(sentText()).toContain('1080x1920');
    });

    it('forces a JSON verdict and caches the system prompt', async () => {
      await service.inspect('a1');
      expect(sent().output_config.format.type).toBe('json_schema');
      expect(sent().system).toHaveLength(1);
      expect(sent().system[0].cache_control).toEqual({ type: 'ephemeral' });
    });

    it('defaults the model and lets the environment override it', async () => {
      await service.inspect('a1');
      expect(sent().model).toBe('claude-sonnet-5');

      create.mockClear();
      env.GAME_CHEAT_MODEL = 'claude-opus-5';
      await service.inspect('a1');
      expect(sent().model).toBe('claude-opus-5');
    });

    /** With a task on the row, the photo is judged against that task. */
    it('includes the task brief and criteria when the attempt names one', async () => {
      attemptRepo.findOne.mockResolvedValue(attempt({ taskTemplateId: 't1' }));
      templateRepo.findOne.mockResolvedValue({
        id: 't1',
        title: 'Nine',
        brief: 'Nine things in one room that are the same colour.',
        guards: ['own_wardrobe'],
        criteria: [
          {
            id: 'c1',
            modality: 'visual',
            required: true,
            assert: 'Nine objects.',
          },
        ],
      });
      await service.inspect('a1');
      expect(templateRepo.findOne).toHaveBeenCalledWith({
        where: { id: 't1' },
      });
      expect(sentText()).toContain('Task: Nine');
      expect(sentText()).toContain('Nine things in one room');
      expect(sentText()).toContain('own_wardrobe');
      expect(sentText()).toContain('[visual, required] Nine objects.');
      expect(sentText()).not.toContain('No task context');
    });

    it('says so when there is no task to judge against', async () => {
      await service.inspect('a1');
      expect(sentText()).toContain('No task context was given');
      expect(templateRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('the verdict', () => {
    it('stores an authentic verdict and moves nothing', async () => {
      create.mockResolvedValue(
        reply({
          verdict: 'authentic',
          confidence: 0.95,
          reasons: ['Looks like a phone photo.'],
          signals: [],
        }),
      );
      const verdict = await service.inspect('a1');
      expect(verdict).toMatchObject({
        verdict: 'authentic',
        confidence: 0.95,
        enforced: false,
        model: 'claude-sonnet-5',
        mode: 'enforce',
      });
      expect(stored()).toMatchObject({ verdict: 'authentic', enforced: false });
      expect(discipline.flagCheater).not.toHaveBeenCalled();
    });

    /** The whole point: a confident call zeroes the account and the attempt. */
    it('enforces a confident cheating verdict through the discipline service', async () => {
      create.mockResolvedValue(
        reply({
          verdict: 'cheating',
          confidence: 0.97,
          reasons: ['It is a screenshot of a browser window.'],
          signals: ['screenshot'],
        }),
      );
      const verdict = await service.inspect('a1');
      expect(verdict).toMatchObject({
        verdict: 'cheating',
        enforced: true,
        signals: ['screenshot'],
      });
      expect(discipline.flagCheater).toHaveBeenCalledWith('e1', {
        attemptId: 'a1',
        by: 'ai',
        reason: 'It is a screenshot of a browser window.',
      });
    });

    it('falls back to a stock reason when the model gave none', async () => {
      create.mockResolvedValue(
        reply({
          verdict: 'cheating',
          confidence: 0.99,
          reasons: [],
          signals: [],
        }),
      );
      await service.inspect('a1');
      expect(discipline.flagCheater).toHaveBeenCalledWith(
        'e1',
        expect.objectContaining({
          reason: 'The cheat detector found this hand-in is not genuine.',
        }),
      );
    });

    /**
     * Below the bar the call is kept for a reviewer but not acted on. A
     * wrong zeroing costs the game an honest player; a missed one costs it
     * one attempt a person still sees.
     */
    it('downgrades cheating below the threshold to suspicious', async () => {
      create.mockResolvedValue(
        reply({
          verdict: 'cheating',
          confidence: 0.6,
          reasons: ['Possibly edited.'],
          signals: ['edited'],
        }),
      );
      const verdict = await service.inspect('a1');
      expect(verdict).toMatchObject({
        verdict: 'suspicious',
        confidence: 0.6,
        enforced: false,
      });
      expect(verdict?.reasons).toHaveLength(2);
      expect(verdict?.reasons[1]).toMatch(/below the 0.85/);
      expect(stored()).toMatchObject({ verdict: 'suspicious' });
      expect(discipline.flagCheater).not.toHaveBeenCalled();
    });

    it('reads the threshold from the environment', async () => {
      env.GAME_CHEAT_CONFIDENCE = '0.5';
      create.mockResolvedValue(
        reply({
          verdict: 'cheating',
          confidence: 0.6,
          reasons: ['x'],
          signals: [],
        }),
      );
      const verdict = await service.inspect('a1');
      expect(verdict).toMatchObject({ verdict: 'cheating', enforced: true });
      expect(discipline.flagCheater).toHaveBeenCalled();
    });

    it('stores but does not enforce in shadow mode', async () => {
      env.GAME_CHEAT_DETECTION = 'shadow';
      create.mockResolvedValue(
        reply({
          verdict: 'cheating',
          confidence: 0.99,
          reasons: ['AI-generated.'],
          signals: ['ai_generated'],
        }),
      );
      const verdict = await service.inspect('a1');
      expect(verdict).toMatchObject({
        verdict: 'cheating',
        enforced: false,
        mode: 'shadow',
      });
      expect(stored()).toMatchObject({ verdict: 'cheating', mode: 'shadow' });
      expect(discipline.flagCheater).not.toHaveBeenCalled();
    });

    it('stores a suspicious verdict for a person and moves nothing', async () => {
      create.mockResolvedValue(
        reply({
          verdict: 'suspicious',
          confidence: 0.7,
          reasons: ['Odd shadows.'],
          signals: ['edited'],
        }),
      );
      const verdict = await service.inspect('a1');
      expect(verdict).toMatchObject({ verdict: 'suspicious', enforced: false });
      expect(discipline.flagCheater).not.toHaveBeenCalled();
    });

    it('drops signals the schema does not name', async () => {
      create.mockResolvedValue(
        reply({
          verdict: 'suspicious',
          confidence: 0.7,
          reasons: ['x'],
          signals: ['edited', 'made_up'],
        }),
      );
      const verdict = await service.inspect('a1');
      expect(verdict?.signals).toEqual(['edited']);
    });
  });

  describe('when the model cannot be used', () => {
    it('records a refusal as unchecked rather than cleared', async () => {
      create.mockResolvedValue(
        reply(
          {},
          {
            stop_reason: 'refusal',
            stop_details: { type: 'refusal', category: 'other' },
            content: [],
          },
        ),
      );
      const verdict = await service.inspect('a1');
      expect(verdict).toMatchObject({
        verdict: 'unchecked',
        skipped: 'error',
        enforced: false,
      });
      expect(verdict?.reasons[0]).toMatch(/declined/);
      expect(stored()).toMatchObject({ skipped: 'error' });
      expect(discipline.flagCheater).not.toHaveBeenCalled();
    });

    it('records an API failure as unchecked and does not throw', async () => {
      create.mockRejectedValue(new Error('socket hang up'));
      const verdict = await service.inspect('a1');
      expect(verdict).toMatchObject({ verdict: 'unchecked', skipped: 'error' });
      expect(verdict?.reasons[0]).toContain('socket hang up');
      expect(stored()).toMatchObject({ verdict: 'unchecked' });
    });

    it('records an unreadable reply as unchecked', async () => {
      create.mockResolvedValue(
        reply({}, { content: [{ type: 'text', text: '{not json' }] }),
      );
      const verdict = await service.inspect('a1');
      expect(verdict).toMatchObject({ verdict: 'unchecked', skipped: 'error' });
    });

    it('records a reply with an unknown verdict as unchecked', async () => {
      create.mockResolvedValue(
        reply({ verdict: 'maybe', confidence: 0.5, reasons: [], signals: [] }),
      );
      const verdict = await service.inspect('a1');
      expect(verdict).toMatchObject({ verdict: 'unchecked', skipped: 'error' });
    });
  });

  describe('writing the verdict', () => {
    beforeEach(() => {
      create.mockResolvedValue(
        reply({
          verdict: 'cheating',
          confidence: 0.99,
          reasons: ['Screenshot.'],
          signals: ['screenshot'],
        }),
      );
    });

    /** The write carries the same condition as the read, so a reviewer wins. */
    it('only touches a row still in submitted', async () => {
      await service.inspect('a1');
      const [sql, params] = attemptRepo.query.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(sql).toMatch(/"status" = 'submitted'/);
      expect(sql).toMatch(/"aiVerdict" = \$2::jsonb/);
      expect(sql).toMatch(/"aiCheckedAt" = now\(\)/);
      expect(params[0]).toBe('a1');
    });

    it('does not enforce when a person settled it in the meantime', async () => {
      attemptRepo.query.mockResolvedValue([]);
      const verdict = await service.inspect('a1');
      expect(verdict).toMatchObject({ verdict: 'cheating', enforced: true });
      expect(discipline.flagCheater).not.toHaveBeenCalled();
    });

    it('swallows an already-marked conflict from the discipline service', async () => {
      discipline.flagCheater.mockRejectedValue(
        new ConflictException('That account is already marked as a cheater.'),
      );
      await expect(service.inspect('a1')).resolves.toMatchObject({
        verdict: 'cheating',
      });
    });

    it('lets any other discipline failure reach the caller', async () => {
      discipline.flagCheater.mockRejectedValue(new Error('db down'));
      await expect(service.inspect('a1')).rejects.toThrow('db down');
    });
  });

  describe('inspectLater', () => {
    it('never rejects, even when inspect does', async () => {
      attemptRepo.findOne.mockRejectedValue(new Error('boom'));
      const errorLog = jest.spyOn(service['logger'], 'error');
      expect(() => service.inspectLater('a1')).not.toThrow();
      await new Promise((resolve) => setImmediate(resolve));
      expect(errorLog).toHaveBeenCalled();
    });
  });
});
