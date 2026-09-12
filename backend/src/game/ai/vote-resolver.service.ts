import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GameAttempt } from '../entities/game-attempt.entity';
import type { GameTaskTemplate } from '../entities/game-task-template.entity';
import {
  clampVoteReward,
  defaultVoteReward,
  VOTE_REWARD_MAX_COINS,
  VOTE_REWARD_MIN_COINS,
} from '../rules';

export interface VoteResolution {
  outcome: 'confirmed' | 'not_confirmed' | 'unsure';
  confidence: number;
  /** Coins each correct "yes" voter earns. Within the rule's range. */
  payout: number;
  reasons: string[];
  model: string | null;
}

const RESOLUTION_SCHEMA = {
  type: 'object',
  properties: {
    outcome: {
      type: 'string',
      enum: ['confirmed', 'not_confirmed', 'unsure'],
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    payout: {
      type: 'integer',
      minimum: VOTE_REWARD_MIN_COINS,
      maximum: VOTE_REWARD_MAX_COINS,
    },
    reasons: { type: 'array', items: { type: 'string' }, maxItems: 5 },
  },
  required: ['outcome', 'confidence', 'payout', 'reasons'],
  additionalProperties: false,
} as const;

const DEFAULT_MODEL = 'claude-sonnet-5';

const SYSTEM_PROMPT = `
You resolve the watchers' vote on a hand-in in Stiff, a dare game played in
Tbilisi. A player was given a task and handed in a photo as proof. Watchers
then voted "yes" (the task was really done) or "no". Your job is to decide
whether the task was actually, visibly done in the photo — and to weigh the
vote as evidence, not as the answer.

Rules:
- "confirmed" only when the photo shows the task being done as the brief and
  its criteria require. The vote may agree with you; it may not. A landslide
  "yes" on a photo that does not show the task is still "not_confirmed".
- "not_confirmed" when the photo clearly does not show the task, is not a
  real photo, or contradicts a required criterion.
- "unsure" when you cannot tell from the image. That hands it to a person.
  Prefer this to guessing.
- Ignore the cheat detector's verdict except as one more signal; it may have
  been "unchecked".
- Never judge or describe any person's appearance, age, gender, ethnicity or
  identity.

payout is what each correct "yes" voter earns: ${VOTE_REWARD_MIN_COINS} for an
obvious call, up to ${VOTE_REWARD_MAX_COINS} for a genuinely hard one where a
careful watcher earned it. Always give a payout, whatever the outcome.

Reasons are short sentences, at most five, each naming something visible.
`.trim();

/**
 * The vote resolver: when the watchers' window closes, a model looks at the
 * hand-in, the task and the tallies, and says whether the task was done.
 *
 * Only stills are judged, like the cheat detector. A clip, a missing key,
 * an error or a refusal all come back `unsure`, which defers the attempt
 * to a person; the voters are paid when that person approves. The vote
 * itself never decides — it is evidence the resolver weighs.
 */
@Injectable()
export class VoteResolverService {
  private readonly logger = new Logger(VoteResolverService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('ANTHROPIC_API_KEY'));
  }

  private model(): string {
    return (
      this.config.get<string>('GAME_VOTE_RESOLVER_MODEL')?.trim() ||
      DEFAULT_MODEL
    );
  }

  async resolve(input: {
    attempt: GameAttempt;
    template: GameTaskTemplate | null;
    yes: number;
    no: number;
  }): Promise<VoteResolution> {
    const { attempt, template, yes, no } = input;
    const fallback = defaultVoteReward(attempt.day);

    if (!this.isConfigured()) {
      return this.unsure(
        'The resolver is not configured (ANTHROPIC_API_KEY unset).',
        fallback,
        null,
      );
    }
    if (attempt.kind === 'video') {
      return this.unsure(
        'Clips are not judged by the model; a person decides.',
        fallback,
        null,
      );
    }
    if (!attempt.mediaUrl) {
      return this.unsure(
        'The attempt has no media to look at.',
        fallback,
        null,
      );
    }

    const client = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    });
    try {
      const response = await client.messages.create({
        model: this.model(),
        max_tokens: 2048,
        thinking: { type: 'adaptive' },
        output_config: {
          effort: 'medium',
          format: { type: 'json_schema', schema: RESOLUTION_SCHEMA },
        },
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url: attempt.mediaUrl } },
              { type: 'text', text: this.brief(attempt, template, yes, no) },
            ],
          },
        ],
      });

      if (response.stop_reason === 'refusal') {
        return this.unsure(
          `The model declined to look (${response.stop_details?.category ?? 'unknown'}).`,
          fallback,
          response.model,
        );
      }
      const text = response.content.find((b) => b.type === 'text');
      if (!text || text.type !== 'text') {
        return this.unsure(
          'The reply could not be read.',
          fallback,
          response.model,
        );
      }
      const body = JSON.parse(text.text) as Partial<VoteResolution>;
      const outcome =
        body.outcome === 'confirmed' || body.outcome === 'not_confirmed'
          ? body.outcome
          : 'unsure';
      const confidence =
        typeof body.confidence === 'number' && Number.isFinite(body.confidence)
          ? Math.min(Math.max(body.confidence, 0), 1)
          : 0;
      const resolution: VoteResolution = {
        outcome,
        confidence,
        payout: clampVoteReward(body.payout ?? fallback),
        reasons: Array.isArray(body.reasons)
          ? body.reasons
              .filter((r): r is string => typeof r === 'string')
              .slice(0, 5)
          : [],
        model: response.model,
      };
      this.logger.log(
        `Vote on ${attempt.id}: ${yes} yes / ${no} no -> ${resolution.outcome} (${confidence.toFixed(2)}, pays ${resolution.payout})`,
      );
      return resolution;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Vote resolver failed on ${attempt.id}: ${message}`);
      return this.unsure(`The resolver failed: ${message}`, fallback, null);
    }
  }

  private brief(
    attempt: GameAttempt,
    template: GameTaskTemplate | null,
    yes: number,
    no: number,
  ): string {
    const lines = ['Resolve the vote on the attached photo.', ''];
    if (template) {
      lines.push(
        `Task: ${template.title}`,
        `Brief: ${template.brief}`,
        `Proof required: ${template.proof}`,
        'Criteria:',
        ...template.criteria.map(
          (c) =>
            `- [${c.modality}${c.required ? ', required' : ''}] ${c.assert}`,
        ),
      );
    } else {
      lines.push(
        'No task context was recorded; judge only whether a real dare is visibly being done.',
      );
    }
    lines.push(
      '',
      `Votes: ${yes} yes, ${no} no`,
      `Caption: ${attempt.caption ?? '(none)'}`,
      `Cheat detector: ${attempt.aiVerdict ? `${attempt.aiVerdict.verdict} (${attempt.aiVerdict.confidence})` : 'not run'}`,
      `Day: ${attempt.day}`,
    );
    return lines.join('\n');
  }

  private unsure(
    reason: string,
    payout: number,
    model: string | null,
  ): VoteResolution {
    return {
      outcome: 'unsure',
      confidence: 0,
      payout,
      reasons: [reason],
      model,
    };
  }
}
