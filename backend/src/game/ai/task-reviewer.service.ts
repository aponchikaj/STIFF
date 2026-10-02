import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BLOCKED_TYPE_IDS,
  isBlockedTypeId,
  renderBlocklist,
} from './blocklist';
import type { GeneratedTask } from './task-generator.service';

export interface ReviewVerdict {
  verdict: 'approve' | 'reject';
  severity: 'ok' | 'bad' | 'illegal';
  /** Ids from `BLOCKED_TASK_TYPES`, when rejected for one. */
  blockedTypes: string[];
  reasons: string[];
  /** What the creator is told, when rejected. Null on approval. */
  feedback: string | null;
  model: string | null;
  reviewedAt: string;
}

/** What the reviewer is made to answer. */
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['approve', 'reject'] },
    severity: { type: 'string', enum: ['ok', 'bad', 'illegal'] },
    blockedTypes: {
      type: 'array',
      items: { type: 'string', enum: [...BLOCKED_TYPE_IDS] },
    },
    reasons: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    feedback: { type: 'string' },
  },
  required: ['verdict', 'severity', 'blockedTypes', 'reasons', 'feedback'],
  additionalProperties: false,
} as const;

const DEFAULT_MODEL = 'claude-opus-5';

/**
 * Stable and cached. The blocklist is the same text the creator was given,
 * so the two agents are arguing from one rulebook.
 */
const SYSTEM_PROMPT = `
You are the reviewer for Stiff, a dare game played in Tbilisi by people aged
16 and over. A separate creator writes tasks; you decide whether each one may
go to players. You are the strict one. The creator has been told to be
careful, and you assume it was not careful enough.

${renderBlocklist()}

Reject a task if ANY of these is true:
- it is one of the blocked types in substance, whatever the wording, however
  small the amount, however jokey the framing
- it is illegal anywhere a player might reasonably be (Georgian law first)
- it could hurt the player, a stranger, an animal, or property
- it needs a stranger to be tricked, embarrassed, touched, filmed without
  agreeing, or approached if they might be under 18
- it needs anyone under 16 in frame
- it needs the player to buy something, travel, or be somewhere they may not be
- it cannot be proved from a photo or a video
- the brief does not say how it is proved, or the "proof" field does not match
  what the brief needs (eating, speaking, performing, another person -> video)
- it is very bad: cruel, humiliating beyond a friendly dare, degrading, or
  simply not something a decent person would ask a friend to do

Gross but harmless is allowed and wanted: pet food, cold beans, socks on
hands, a raw onion, singing badly, dressing wrongly. Do not reject a task for
being silly or embarrassing to the player themselves.

Severity: "illegal" when a blocked type marked illegal applies or the law
would; "bad" for anything else you reject; "ok" only with approve.

Feedback, on a rejection, is one or two sentences addressed to the creator:
name the blocked type or the harm, and say what kind of task to write instead.
Never suggest a softer version of the same idea. On approval feedback is an
empty string.
`.trim();

/**
 * The second agent. Reads what the creator wrote and says yes or no.
 *
 * **Fails closed.** A model error, a refusal, an unparseable reply — each is a
 * rejection with the reason on it, never a pass. A task that this could not
 * review is a task nobody has reviewed, and the loop spends a round on it
 * rather than let it through.
 *
 * Its verdict is a decision, not advice: the pipeline sends a rejection back
 * to the creator with the feedback and asks for a different task. A human
 * still approves the draft into the pool, but a task the reviewer rejected
 * cannot be approved until it is edited and reviewed again.
 */
@Injectable()
export class TaskReviewerService {
  private readonly logger = new Logger(TaskReviewerService.name);
  private readonly client: Anthropic | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private model(): string {
    return (
      this.config.get<string>('GAME_TASK_REVIEWER_MODEL')?.trim() ||
      DEFAULT_MODEL
    );
  }

  async review(
    task: Pick<
      GeneratedTask,
      'title' | 'brief' | 'tier' | 'proof' | 'guards' | 'criteria'
    >,
  ): Promise<ReviewVerdict> {
    const reviewedAt = new Date().toISOString();
    const client = this.client;
    if (!client) {
      return this.closed(
        'The reviewer is not configured (ANTHROPIC_API_KEY unset), so nothing passes.',
        null,
        reviewedAt,
      );
    }

    try {
      const response = await client.messages.create({
        model: this.model(),
        max_tokens: 2048,
        thinking: { type: 'adaptive' },
        output_config: {
          effort: 'high',
          format: { type: 'json_schema', schema: REVIEW_SCHEMA },
        },
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: this.brief(task) }],
      });

      if (response.stop_reason === 'refusal') {
        return this.closed(
          `The reviewer declined to read this task (${response.stop_details?.category ?? 'unknown'}). Treat that as a rejection and write something else.`,
          response.model,
          reviewedAt,
        );
      }

      const parsed = this.parse(response);
      if (!parsed) {
        return this.closed(
          'The reviewer’s reply could not be read. Rejected on principle; write a different task.',
          response.model,
          reviewedAt,
        );
      }

      const verdict: ReviewVerdict = {
        ...parsed,
        model: response.model,
        reviewedAt,
      };
      if (verdict.verdict === 'reject') {
        this.logger.warn(
          `Reviewer rejected "${task.title}" (${verdict.severity}): ` +
            `${verdict.blockedTypes.join('+') || 'no blocked type'} — ${verdict.feedback}`,
        );
      }
      return verdict;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Reviewer failed on "${task.title}": ${message}`);
      return this.closed(
        `The reviewer could not run (${message}). Rejected on principle; the task was never reviewed.`,
        null,
        reviewedAt,
      );
    }
  }

  private brief(
    task: Pick<
      GeneratedTask,
      'title' | 'brief' | 'tier' | 'proof' | 'guards' | 'criteria'
    >,
  ): string {
    return [
      'Review this task.',
      '',
      `Tier: ${task.tier}`,
      `Title: ${task.title}`,
      `Brief: ${task.brief}`,
      `Proof: ${task.proof}`,
      `Guards: ${task.guards?.length ? task.guards.join(', ') : 'none'}`,
      'Criteria:',
      ...(task.criteria ?? []).map(
        (c) => `- [${c.modality}${c.required ? ', required' : ''}] ${c.assert}`,
      ),
    ].join('\n');
  }

  private parse(
    response: Anthropic.Message,
  ): Omit<ReviewVerdict, 'model' | 'reviewedAt'> | null {
    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return null;
    try {
      const body = JSON.parse(text.text) as Partial<ReviewVerdict>;
      if (body.verdict !== 'approve' && body.verdict !== 'reject') return null;
      const blockedTypes = Array.isArray(body.blockedTypes)
        ? body.blockedTypes.filter(
            (t): t is string => typeof t === 'string' && isBlockedTypeId(t),
          )
        : [];
      const reasons = Array.isArray(body.reasons)
        ? body.reasons.filter((r): r is string => typeof r === 'string')
        : [];
      // A verdict that names a blocked type is a rejection whatever the flag
      // said, and an approval carries no severity but ok.
      const verdict = blockedTypes.length > 0 ? 'reject' : body.verdict;
      const severity =
        verdict === 'approve'
          ? 'ok'
          : body.severity === 'illegal'
            ? 'illegal'
            : 'bad';
      const feedback =
        verdict === 'reject'
          ? (typeof body.feedback === 'string' && body.feedback.trim()) ||
            reasons[0] ||
            'Rejected by the reviewer. Write a different task.'
          : null;
      return { verdict, severity, blockedTypes, reasons, feedback };
    } catch {
      return null;
    }
  }

  private closed(
    reason: string,
    model: string | null,
    reviewedAt: string,
  ): ReviewVerdict {
    return {
      verdict: 'reject',
      severity: 'bad',
      blockedTypes: [],
      reasons: [reason],
      feedback: reason,
      model,
      reviewedAt,
    };
  }
}
