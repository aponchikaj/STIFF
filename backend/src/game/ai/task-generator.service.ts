import Anthropic from '@anthropic-ai/sdk';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CHARTER, CHARTER_HASH } from './charter';
import { screen, type Violation } from './exclusions';

/**
 * The AI half: Claude writes task briefs, and nothing it writes is trusted.
 *
 * Three properties matter more than the prompt.
 *
 * **Generated tasks are drafts.** Nothing here publishes. The roadmap's gate is
 * explicit — no coin, heart or Nerve point moves on a model's say-so until
 * shadow mode has run a full season — and the same logic applies upstream: a
 * task nobody read is not a task, it is a suggestion. `GameAdminService` is
 * still the only thing that can approve one.
 *
 * **The screen runs after the model, always.** The Charter tells the model what
 * it may not write; `screen()` decides whether it listened. A prompt is a
 * request; a screen is a decision. Rejections are kept rather than discarded —
 * what the model got wrong is the training signal for the next Charter edit,
 * and throwing it away is how you end up guessing.
 *
 * **The Charter is cached, not re-billed.** It is large, identical on every
 * call, and sent as a single `cache_control` system block, so a batch of twenty
 * tasks pays for it once. It is also the whole prefix — nothing volatile is
 * placed before it, which is what keeps the cache actually hitting.
 */

export interface GeneratedTask {
  slug: string;
  tier: 1 | 2 | 3;
  title: string;
  brief: string;
  clockMinutes: number;
  guards: string[];
  criteria: {
    id: string;
    modality: string;
    required: boolean;
    assert: string;
  }[];
  /** The model's own note on why this task is worth playing. */
  rationale: string;
}

export interface GenerationOutcome {
  accepted: GeneratedTask[];
  /** Kept, not discarded — this is the signal for the next Charter edit. */
  rejected: { task: GeneratedTask; violations: Violation[] }[];
  charterHash: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
}

/** Forced by `output_config.format`, so the reply is parseable by construction. */
const TASK_SCHEMA = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          tier: { type: 'integer', enum: [1, 2, 3] },
          title: { type: 'string' },
          brief: { type: 'string' },
          clockMinutes: { type: 'integer', enum: [15, 20, 25] },
          guards: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'adults_only',
                'no_contact',
                'outerwear_only',
                'no_obstruction',
                'consent_on_record',
                'own_wardrobe',
              ],
            },
          },
          criteria: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                modality: {
                  type: 'string',
                  enum: [
                    'visual',
                    'temporal',
                    'interaction',
                    'audio',
                    'scene',
                    'liveness',
                  ],
                },
                required: { type: 'boolean' },
                assert: { type: 'string' },
              },
              required: ['id', 'modality', 'required', 'assert'],
              additionalProperties: false,
            },
          },
          rationale: { type: 'string' },
        },
        required: [
          'slug',
          'tier',
          'title',
          'brief',
          'clockMinutes',
          'guards',
          'criteria',
          'rationale',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['tasks'],
  additionalProperties: false,
} as const;

const MODEL = 'claude-opus-5';

@Injectable()
export class TaskGeneratorService {
  private readonly logger = new Logger(TaskGeneratorService.name);
  private readonly client: Anthropic | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn(
        'ANTHROPIC_API_KEY not set — task generation is disabled on this instance',
      );
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Writes a batch of candidate tasks, ahead of the round.
   *
   * Batched deliberately: the Charter dominates the prompt, so one call for
   * twenty tasks costs a fraction of twenty calls for one, and generating
   * ahead of the round means a model outage delays nothing.
   */
  async generate(options: {
    tier: 1 | 2 | 3;
    count: number;
    /** Slugs already in the pool, so the model does not re-write them. */
    avoid?: string[];
    /** Optional steer: a theme, a sponsor's garment, a gap in the pool. */
    steer?: string;
  }): Promise<GenerationOutcome> {
    const client = this.client;
    if (!client) {
      throw new ServiceUnavailableException(
        'Task generation is not available right now.',
      );
    }

    const count = Math.min(Math.max(options.count, 1), 20);
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Adaptive is the default on this model; stated so the intent survives a
      // future model swap. `budget_tokens` is removed and would 400.
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: TASK_SCHEMA },
      },
      // The Charter is the entire cached prefix. Nothing volatile goes before
      // it — a timestamp or a request id here would invalidate the cache on
      // every call and quietly double the bill.
      system: [
        {
          type: 'text',
          text: CHARTER,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: this.brief(options, count) }],
    });

    // A refusal is a 200 with an empty or partial `content`, so this has to be
    // checked before anything reads the body.
    if (response.stop_reason === 'refusal') {
      this.logger.warn(
        `Generation refused: ${response.stop_details?.category ?? 'unknown'}`,
      );
      throw new ServiceUnavailableException(
        'The model declined that request. Rephrase the steer and try again.',
      );
    }

    const parsed = this.parse(response);
    const accepted: GeneratedTask[] = [];
    const rejected: GenerationOutcome['rejected'] = [];

    for (const task of parsed) {
      const result = screen(task);
      if (result.ok) accepted.push(task);
      else rejected.push({ task, violations: result.violations });
    }

    if (rejected.length > 0) {
      // Worth a log line: a Charter that stops holding shows up here first,
      // as a rejection rate that climbs.
      this.logger.warn(
        `Screen rejected ${rejected.length}/${parsed.length} generated tasks ` +
          `(charter ${CHARTER_HASH}): ` +
          rejected
            .map(
              (r) =>
                `${r.task.slug}=${r.violations.map((v) => v.category).join('+')}`,
            )
            .join(', '),
      );
    }

    return {
      accepted,
      rejected,
      charterHash: CHARTER_HASH,
      model: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      },
    };
  }

  /** The volatile half of the prompt — everything that changes per call. */
  private brief(
    options: { tier: number; avoid?: string[]; steer?: string },
    count: number,
  ): string {
    const lines = [
      `Write ${count} tier-${options.tier} tasks.`,
      '',
      'Each must be playable by someone who owns nothing but their own clothes',
      'and a phone, and must be provable from the footage alone.',
    ];
    if (options.avoid?.length) {
      lines.push(
        '',
        'The pool already has these — do not rewrite them or write near-variants:',
        options.avoid.slice(0, 60).join(', '),
      );
    }
    if (options.steer) {
      lines.push('', `Additional direction: ${options.steer}`);
    }
    return lines.join('\n');
  }

  private parse(response: Anthropic.Message): GeneratedTask[] {
    // `output_config.format` guarantees the first text block is valid JSON
    // matching the schema — but a truncated response is still possible, so the
    // parse is guarded rather than assumed.
    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return [];
    try {
      const body = JSON.parse(text.text) as { tasks?: GeneratedTask[] };
      return Array.isArray(body.tasks) ? body.tasks : [];
    } catch {
      this.logger.error(
        `Could not parse generated tasks (stop_reason=${response.stop_reason})`,
      );
      return [];
    }
  }
}
