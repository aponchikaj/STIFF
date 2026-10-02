import Anthropic from '@anthropic-ai/sdk';
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { rowsAffected } from '../../common/utils/returned-rows';
import { DisciplineService } from '../discipline.service';
import {
  GameAttempt,
  type CheatVerdict,
  type CheatVerdictKind,
} from '../entities/game-attempt.entity';
import { GameTaskTemplate } from '../entities/game-task-template.entity';
import {
  cheatConfidenceThreshold,
  cheatDetectionMode,
  type CheatDetectionMode,
} from '../rules';

/** What a photo can be flagged for. Named so the log and the panel agree. */
export const CHEAT_SIGNALS = [
  'screenshot',
  'ai_generated',
  'edited',
  'reused_or_stock',
  'task_mismatch',
  'staged',
  'no_task_context',
] as const;
export type CheatSignal = (typeof CHEAT_SIGNALS)[number];

/** What the model is made to answer. Forced by `output_config.format`. */
const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['authentic', 'suspicious', 'cheating'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reasons: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    signals: {
      type: 'array',
      items: { type: 'string', enum: [...CHEAT_SIGNALS] },
    },
  },
  required: ['verdict', 'confidence', 'reasons', 'signals'],
  additionalProperties: false,
} as const;

/**
 * The stored shape: the entity's `CheatVerdict` plus the model's named
 * signals, which the panel and the log read and the entity does not need
 * to know about.
 */
export type CheatDetectorVerdict = CheatVerdict & { signals: CheatSignal[] };

interface ModelVerdict {
  verdict: Exclude<CheatVerdictKind, 'unchecked'>;
  confidence: number;
  reasons: string[];
  signals: CheatSignal[];
}

const DEFAULT_MODEL = 'claude-sonnet-5';

/**
 * Stable, identical on every call, and therefore cached. Nothing volatile
 * goes in here — the attempt's details are in the user turn.
 */
const SYSTEM_PROMPT = `
You are the cheat detector for a photo-proof game played in Tbilisi. Players
are given a task, do it in the real world, and hand in one photo taken on
their own phone as proof. Your job is to decide whether the image you are
shown is a genuine, freshly taken photo of the player actually doing the task.

Flag, with the matching signal:
- screenshot — a capture of a screen, another app, a website, a video player, a chat
- ai_generated — synthetic imagery: impossible geometry, melted text, uncanny
  hands or faces, too-perfect lighting, generator artefacts
- edited — heavy manipulation: composited elements, cloned regions, pasted-in
  objects, mismatched shadows or perspective
- reused_or_stock — a professional, stock, downloaded or previously published
  image rather than a casual phone photo
- task_mismatch — the image clearly does not show the task being attempted
- staged — a fake set up to look like the task without doing it
- no_task_context — use only when no task was given, so task fit could not be judged

Verdicts:
- authentic — it looks like a real, casual phone photo consistent with the task
- suspicious — something is off but the evidence is not strong; a person will look
- cheating — the evidence is strong and specific

A "cheating" verdict zeroes a real person's account and removes them from the
game. Use it only when you would be comfortable defending the call to that
person with the evidence in front of you. When in doubt, say "suspicious".
Ordinary phone-photo flaws — blur, noise, bad framing, odd colour — are not
evidence of anything.

Never judge, describe or speculate about any person's appearance, age, gender,
ethnicity or identity. Judge the image as evidence, nothing else.

Reasons are short sentences, at most five, each naming something visible in
the image.
`.trim();

/**
 * The cheat detector: a model looks at what was handed in and says whether it
 * is real.
 *
 * Runs after `confirmUpload`, off the request — the player gets their 200 and
 * the verdict lands on the row a few seconds later. The verdict is kept
 * whatever it says (`aiVerdict`), so a reviewer opening the queue sees what
 * the model saw. In `enforce` mode a `cheating` verdict at or above the
 * confidence threshold calls `DisciplineService.flagCheater`, which zeroes the
 * account and rejects the attempt in one transaction. In `shadow` mode the
 * verdict is stored and nothing moves. `off` skips the model entirely.
 *
 * Only stills are judged. The API takes images, not clips, and a clip's first
 * frame is not the clip — so a video attempt is recorded as `unchecked` with
 * `skipped: 'video'` and left for a person. That is written on the row rather
 * than silently passed, so "the AI cleared it" can never be said of something
 * the AI never saw.
 */
@Injectable()
export class CheatDetectorService {
  private readonly logger = new Logger(CheatDetectorService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(GameAttempt)
    private readonly attemptRepo: Repository<GameAttempt>,
    @InjectRepository(GameTaskTemplate)
    private readonly templateRepo: Repository<GameTaskTemplate>,
    private readonly discipline: DisciplineService,
  ) {}

  /** `ANTHROPIC_API_KEY` is set. Without it every verdict is `unchecked`. */
  isConfigured(): boolean {
    return Boolean(this.config.get<string>('ANTHROPIC_API_KEY'));
  }

  mode(): CheatDetectionMode {
    return cheatDetectionMode(this.config);
  }

  threshold(): number {
    return cheatConfidenceThreshold(this.config);
  }

  /**
   * Fire-and-forget entry point for the upload path. Never throws, never
   * blocks the response; failures are logged and recorded on the row.
   */
  inspectLater(attemptId: string): void {
    void this.inspect(attemptId).catch((err: unknown) => {
      this.logger.error(
        `Cheat check failed for attempt ${attemptId}`,
        err instanceof Error ? err.stack : String(err),
      );
    });
  }

  /**
   * Judges one attempt, stores the verdict, and enforces it when the mode and
   * the confidence say so. Returns the verdict written, or null when the
   * attempt was not in a state to be judged.
   *
   * Never re-judges something a person has settled: only a row still in
   * `submitted` is looked at, and the write below carries the same condition,
   * so a reviewer who publishes while the model is thinking wins.
   */
  async inspect(attemptId: string): Promise<CheatDetectorVerdict | null> {
    const attempt = await this.attemptRepo.findOne({
      where: { id: attemptId },
    });
    if (!attempt || attempt.status !== 'submitted') return null;

    const mode = this.mode();
    let verdict: CheatDetectorVerdict;

    if (mode === 'off') {
      verdict = this.unchecked(mode, 'disabled', [
        'Cheat detection is off on this instance.',
      ]);
    } else if (!this.isConfigured()) {
      verdict = this.unchecked(mode, 'not_configured', [
        'ANTHROPIC_API_KEY is not set, so the model was not asked.',
      ]);
    } else if (attempt.kind === 'video') {
      verdict = this.unchecked(mode, 'video', [
        'Clips are not judged by the model and are left for a person to review.',
      ]);
    } else if (!attempt.mediaUrl) {
      verdict = this.unchecked(mode, 'no_media', [
        'The attempt has no media URL to look at.',
      ]);
    } else {
      verdict = await this.judge(attempt, mode);
    }

    const written = rowsAffected(
      await this.attemptRepo.query(
        `UPDATE "game_attempts"
            SET "aiVerdict" = $2::jsonb,
                "aiCheckedAt" = now(),
                "updatedAt" = now()
          WHERE "id" = $1 AND "status" = 'submitted'
          RETURNING "id"`,
        [attempt.id, JSON.stringify(verdict)],
      ),
    );

    if (verdict.verdict !== 'authentic') {
      this.logger.warn(
        `Attempt ${attempt.id}: ${verdict.verdict} ` +
          `(confidence ${verdict.confidence.toFixed(2)}, ` +
          `signals ${verdict.signals.join('+') || 'none'}, ` +
          `mode ${mode}${verdict.skipped ? `, skipped ${verdict.skipped}` : ''})`,
      );
    }

    // Settled by a person between the read and the write. Their call stands,
    // so nothing is enforced on a verdict that was never stored.
    if (written === 0) return verdict;

    if (verdict.enforced) {
      try {
        await this.discipline.flagCheater(attempt.enrolmentId, {
          attemptId: attempt.id,
          by: 'ai',
          reason:
            verdict.reasons[0] ??
            'The cheat detector found this hand-in is not genuine.',
        });
      } catch (err) {
        if (err instanceof ConflictException) {
          this.logger.warn(
            `Attempt ${attempt.id}: enrolment ${attempt.enrolmentId} was already marked — ${err.message}`,
          );
        } else {
          throw err;
        }
      }
    }

    return verdict;
  }

  // ------------------------------------------------------------- the call --

  /**
   * Asks the model. Any failure — a refusal, a network error, an unparseable
   * reply — becomes an `unchecked` verdict with the reason on it rather than a
   * thrown error: the row must always end up saying what happened.
   */
  private async judge(
    attempt: GameAttempt,
    mode: CheatDetectionMode,
  ): Promise<CheatDetectorVerdict> {
    const model =
      this.config.get<string>('GAME_CHEAT_MODEL')?.trim() || DEFAULT_MODEL;
    const client = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    });

    try {
      const template = attempt.taskTemplateId
        ? await this.templateRepo.findOne({
            where: { id: attempt.taskTemplateId },
          })
        : null;

      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        // Adaptive is the default on this model; stated so the intent
        // survives a future model swap.
        thinking: { type: 'adaptive' },
        output_config: {
          effort: 'medium',
          format: { type: 'json_schema', schema: VERDICT_SCHEMA },
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
              {
                type: 'image',
                source: { type: 'url', url: attempt.mediaUrl as string },
              },
              { type: 'text', text: this.brief(attempt, template) },
            ],
          },
        ],
      });

      // A refusal is a 200 with an empty or partial `content`, so it has to
      // be checked before anything reads the body.
      if (response.stop_reason === 'refusal') {
        return this.unchecked(
          mode,
          'error',
          [
            `The model declined to look at this image (${response.stop_details?.category ?? 'unknown'}).`,
          ],
          response.model,
        );
      }

      const parsed = this.parse(response);
      if (!parsed) {
        return this.unchecked(
          mode,
          'error',
          [
            `The model's reply could not be read (stop_reason=${response.stop_reason}).`,
          ],
          response.model,
        );
      }

      return this.settle(parsed, mode, response.model);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Cheat check for attempt ${attempt.id} failed: ${message}`,
        err instanceof Error ? err.stack : undefined,
      );
      return this.unchecked(mode, 'error', [`The check failed: ${message}`]);
    }
  }

  /** The volatile half of the prompt — everything that changes per attempt. */
  private brief(
    attempt: GameAttempt,
    template: GameTaskTemplate | null,
  ): string {
    const lines: string[] = ['Judge the attached photo.', ''];

    if (template) {
      lines.push(
        `Task: ${template.title}`,
        `Brief: ${template.brief}`,
        `Guards: ${template.guards.length ? template.guards.join(', ') : 'none'}`,
        'Criteria a verifier checks against the footage:',
        ...template.criteria.map(
          (c) =>
            `- [${c.modality}${c.required ? ', required' : ''}] ${c.assert}`,
        ),
      );
    } else {
      lines.push(
        'No task context was given for this attempt. Judge only whether the',
        'image is a genuine phone photo; use the no_task_context signal and do',
        'not use task_mismatch.',
      );
    }

    lines.push(
      '',
      `Day: ${attempt.day}`,
      `Caption: ${attempt.caption ?? '(none)'}`,
      `Type: ${attempt.mimeType}`,
      `Dimensions: ${
        attempt.width && attempt.height
          ? `${attempt.width}x${attempt.height}`
          : 'unknown'
      }`,
    );
    return lines.join('\n');
  }

  private parse(response: Anthropic.Message): ModelVerdict | null {
    // `output_config.format` guarantees the first text block matches the
    // schema — but a truncated response is still possible, so the parse is
    // guarded rather than assumed.
    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return null;
    try {
      const body = JSON.parse(text.text) as Partial<ModelVerdict>;
      if (
        body.verdict !== 'authentic' &&
        body.verdict !== 'suspicious' &&
        body.verdict !== 'cheating'
      ) {
        return null;
      }
      const confidence =
        typeof body.confidence === 'number' && Number.isFinite(body.confidence)
          ? Math.min(Math.max(body.confidence, 0), 1)
          : 0;
      return {
        verdict: body.verdict,
        confidence,
        reasons: Array.isArray(body.reasons)
          ? body.reasons.filter((r): r is string => typeof r === 'string')
          : [],
        signals: Array.isArray(body.signals)
          ? body.signals.filter((s): s is CheatSignal =>
              (CHEAT_SIGNALS as readonly string[]).includes(s as string),
            )
          : [],
      };
    } catch {
      return null;
    }
  }

  /**
   * Turns what the model said into what the game does about it.
   *
   * A `cheating` verdict below the threshold is stored as `suspicious` —
   * still visible to a reviewer, but not acted on. `enforced` is only ever
   * true in `enforce` mode, for `cheating`, at or above the threshold.
   */
  private settle(
    parsed: ModelVerdict,
    mode: CheatDetectionMode,
    model: string,
  ): CheatDetectorVerdict {
    const threshold = this.threshold();
    let verdict: CheatVerdictKind = parsed.verdict;
    const reasons = [...parsed.reasons];

    if (verdict === 'cheating' && parsed.confidence < threshold) {
      verdict = 'suspicious';
      reasons.push(
        `The model said cheating at ${parsed.confidence.toFixed(2)}, below the ${threshold.toFixed(2)} needed to act on it.`,
      );
    }

    return {
      verdict,
      confidence: parsed.confidence,
      reasons,
      signals: parsed.signals,
      model,
      checkedAt: new Date().toISOString(),
      mode,
      enforced: mode === 'enforce' && verdict === 'cheating',
    };
  }

  private unchecked(
    mode: CheatDetectionMode,
    skipped: NonNullable<CheatVerdict['skipped']>,
    reasons: string[],
    model: string | null = null,
  ): CheatDetectorVerdict {
    return {
      verdict: 'unchecked',
      confidence: 0,
      reasons,
      signals: [],
      model,
      checkedAt: new Date().toISOString(),
      mode,
      enforced: false,
      skipped,
    };
  }
}
