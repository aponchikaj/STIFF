import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TaskReview } from '../entities/game-task-template.entity';
import { CHARTER_HASH } from './charter';
import { screen, type Violation } from './exclusions';
import {
  TaskGeneratorService,
  type GeneratedTask,
  type GenerationOutcome,
} from './task-generator.service';
import {
  TaskReviewerService,
  type ReviewVerdict,
} from './task-reviewer.service';

/** A task that came out the far end, with the verdict that let it. */
export interface ReviewedTask {
  task: GeneratedTask;
  review: TaskReview;
}

/** One refusal, by either gate, on one round. */
export interface PipelineRejection {
  task: GeneratedTask;
  source: 'screen' | 'reviewer';
  round: number;
  violations: Violation[];
  /** What the creator was told. */
  feedback: string;
  review?: ReviewVerdict;
}

export interface PipelineOutcome {
  accepted: ReviewedTask[];
  rejected: PipelineRejection[];
  /** Slots that ran out of rounds without an acceptable task. */
  dropped: number;
  rounds: number;
  maxRounds: number;
  charterHash: string;
  models: { creator: string | null; reviewer: string | null };
  usage: GenerationOutcome['usage'];
}

export const DEFAULT_MAX_ROUNDS = 3;

/**
 * The two agents, in a loop.
 *
 * The creator writes a batch. Every task then passes two gates in order: the
 * regex screen (deterministic, cannot be argued with) and the reviewer agent
 * (reads for substance). A refusal from either goes back to the creator with
 * the reason, and the creator writes a *different* task for that slot. Up to
 * `maxRounds` per slot; a slot that never produces an acceptable task is
 * dropped rather than filled with the least-bad attempt.
 *
 * Every refusal is kept, with which gate refused it and what the creator was
 * told. A rejection rate that climbs is the first sign the Charter stopped
 * holding, and a reviewer that never rejects is a reviewer that has been
 * weakened.
 *
 * Nothing here publishes. What comes out is filed as drafts by
 * `TaskTemplatesService.fileBatch`, each carrying the review that let it
 * through, and a person still approves it into the pool.
 */
@Injectable()
export class TaskPipelineService {
  private readonly logger = new Logger(TaskPipelineService.name);

  constructor(
    private readonly creator: TaskGeneratorService,
    private readonly reviewer: TaskReviewerService,
    private readonly config: ConfigService,
  ) {}

  maxRounds(): number {
    const raw = this.config.get<string>('GAME_TASK_MAX_ROUNDS');
    const parsed = raw === undefined ? NaN : Number.parseInt(String(raw), 10);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 10
      ? parsed
      : DEFAULT_MAX_ROUNDS;
  }

  async run(options: {
    tier: 1 | 2 | 3;
    count: number;
    avoid?: string[];
    steer?: string;
    mode?: 'solo' | 'team';
  }): Promise<PipelineOutcome> {
    const maxRounds = this.maxRounds();
    const first = await this.creator.generate(options);

    const usage = { ...first.usage };
    const accepted: ReviewedTask[] = [];
    const rejected: PipelineRejection[] = [];
    let reviewerModel: string | null = null;
    let deepest = 1;
    let dropped = 0;

    // Round one is the batch. A slot the screen emptied inside `generate`
    // starts with a refusal to hand back; the others start with a candidate.
    const slots: Slot[] = [
      ...first.accepted.map((task) => ({ current: task, pending: null })),
      ...first.rejected.map((entry) => {
        const feedback = feedbackFrom(entry.violations);
        rejected.push({
          task: entry.task,
          source: 'screen',
          round: 1,
          violations: entry.violations,
          feedback,
        });
        return { current: null, pending: { task: entry.task, feedback } };
      }),
    ];

    for (const slot of slots) {
      let { current, pending } = slot;
      let round = 1;
      let done = false;

      while (!done) {
        if (!current) {
          // A refusal spends the round; the replacement is the next one.
          if (!pending) break;
          round += 1;
          if (round > maxRounds) break;
          deepest = Math.max(deepest, round);
          const revised = await this.creator.revise({
            tier: options.tier,
            rejected: pending.task,
            feedback: pending.feedback,
            // Slugs already accepted are avoided too, so a revision cannot
            // land on a task this batch already has.
            avoid: [
              ...(options.avoid ?? []),
              ...accepted.map((a) => a.task.slug),
            ],
            steer: options.steer,
          });
          addUsage(usage, revised.usage);
          if (!revised.task) break;
          current = revised.task;
        }

        // Gate one: the screen. Deterministic, and it runs first because a
        // task it refuses is not worth a reviewer call.
        const screened = screen(current);
        if (!screened.ok) {
          const feedback = feedbackFrom(screened.violations);
          rejected.push({
            task: current,
            source: 'screen',
            round,
            violations: screened.violations,
            feedback,
          });
          pending = { task: current, feedback };
          current = null;
          continue;
        }

        // Gate two: the reviewer.
        const review = await this.reviewer.review(current);
        reviewerModel = review.model ?? reviewerModel;
        if (review.verdict === 'reject') {
          const feedback = review.feedback ?? review.reasons.join(' ');
          rejected.push({
            task: current,
            source: 'reviewer',
            round,
            violations: [],
            feedback,
            review,
          });
          pending = { task: current, feedback };
          current = null;
          continue;
        }

        accepted.push({
          task: current,
          review: {
            verdict: 'approve',
            severity: 'ok',
            blockedTypes: [],
            reasons: review.reasons,
            feedback: null,
            model: review.model,
            reviewedAt: review.reviewedAt,
            round,
          },
        });
        done = true;
      }

      if (!done) dropped += 1;
    }

    this.logger.log(
      `Pipeline tier ${options.tier}: ${accepted.length} accepted, ` +
        `${rejected.length} refusal(s), ${dropped} dropped, ${deepest} round(s)`,
    );

    return {
      accepted,
      rejected,
      dropped,
      rounds: deepest,
      maxRounds,
      charterHash: CHARTER_HASH,
      models: { creator: first.model, reviewer: reviewerModel },
      usage,
    };
  }
}

/** One slot of the batch, worked to completion or dropped. */
interface Slot {
  current: GeneratedTask | null;
  pending: { task: GeneratedTask; feedback: string } | null;
}

/** The screen's violations, as one instruction to the creator. */
export function feedbackFrom(violations: Violation[]): string {
  return violations
    .map((v) => `${v.category} ("${v.matched}"): ${v.remedy}`)
    .join(' ');
}

function addUsage(
  into: GenerationOutcome['usage'],
  add: GenerationOutcome['usage'],
): void {
  into.inputTokens += add.inputTokens;
  into.outputTokens += add.outputTokens;
  into.cacheReadTokens += add.cacheReadTokens;
}
