import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { rowsAffected } from '../common/utils/returned-rows';
import { User } from '../users/user.entity';
import { screen } from './ai/exclusions';
import { clampPenalty } from './rules';
import type { PipelineOutcome } from './ai/task-pipeline.service';
import type { ReviewVerdict } from './ai/task-reviewer.service';
import { GameGenerationRejection } from './entities/game-generation-rejection.entity';
import {
  GameTaskTemplate,
  type TaskMode,
  type TaskProof,
  type TaskReview,
  type TemplateCriterion,
  type TemplateStatus,
} from './entities/game-task-template.entity';

/** A task as a player sees it. */
export interface PlayableTask {
  id: string;
  slug: string;
  tier: number;
  title: string;
  brief: string;
  proof: TaskProof;
  mode: TaskMode;
  rewardNerve: number;
  rewardCoins: number;
  penaltyCoins: number;
  clockMinutes: number;
  guards: string[];
  criteria: TemplateCriterion[];
}

export interface PoolStats {
  charterHash: string;
  generated: number;
  rejected: number;
  /** Rejections per category, so a Charter edit can be measured rather than felt. */
  byCategory: Record<string, number>;
}

/**
 * The task pool: what the game can hand out, and what the screen refused.
 *
 * Two rules hold this together.
 *
 * **A generated task lands as a draft, and only a person approves it.** That is
 * not politeness about AI — it is the roadmap's gate applied one step upstream.
 * A task nobody read is a suggestion, and the database enforces it too:
 * `CHK_game_task_templates_approval` rejects an approved row with no approver.
 *
 * **Rejections are stored, not just returned.** The screen's job is to reject;
 * this is what makes rejecting *useful*. A rate that climbs after a Charter
 * edit is the first sign the edit stopped holding, and a rate that sits at zero
 * across hundreds of generations usually means the screen was weakened rather
 * than that the model improved.
 */
@Injectable()
export class TaskTemplatesService {
  private readonly logger = new Logger(TaskTemplatesService.name);

  constructor(
    @InjectRepository(GameTaskTemplate)
    private readonly templateRepo: Repository<GameTaskTemplate>,
    @InjectRepository(GameGenerationRejection)
    private readonly rejectionRepo: Repository<GameGenerationRejection>,
  ) {}

  /**
   * Files a generation batch: accepted tasks become drafts, rejections become
   * evidence.
   *
   * Slug collisions are skipped rather than failing the batch. A model asked
   * for twenty tasks while told to avoid the existing pool will still
   * occasionally land on a name already taken; losing the other nineteen over
   * it would be a worse outcome than quietly keeping what is new.
   */
  async fileBatch(outcome: PipelineOutcome): Promise<{
    saved: GameTaskTemplate[];
    skipped: string[];
    rejectionsStored: number;
  }> {
    const slugs = outcome.accepted.map((t) => normaliseSlug(t.task.slug));
    const taken = new Set(
      slugs.length === 0
        ? []
        : (
            await this.templateRepo.find({
              where: { slug: In(slugs) },
              select: { slug: true },
            })
          ).map((row) => row.slug),
    );

    const saved: GameTaskTemplate[] = [];
    const skipped: string[] = [];
    // Guards against a model returning the same slug twice inside one batch,
    // which the database would only catch as a failed insert.
    const seen = new Set<string>();

    for (const { task, review } of outcome.accepted) {
      const slug = normaliseSlug(task.slug);
      if (taken.has(slug) || seen.has(slug)) {
        skipped.push(slug);
        continue;
      }
      seen.add(slug);
      saved.push(
        await this.templateRepo.save(
          this.templateRepo.create({
            slug,
            tier: task.tier,
            title: task.title,
            brief: task.brief,
            proof: task.proof ?? 'either',
            mode: task.mode ?? 'solo',
            rewardNerve: Math.max(0, Math.round(task.rewardNerve ?? 0)),
            rewardCoins: Math.max(0, Math.round(task.rewardCoins ?? 0)),
            penaltyCoins: clampPenalty(task.penaltyCoins),
            clockMinutes: task.clockMinutes,
            guards: task.guards ?? [],
            criteria: task.criteria ?? [],
            rationale: task.rationale ?? null,
            review,
            // Draft, always. Two agents have said yes; a person still reads
            // it before a player does.
            status: 'draft',
            origin: 'generated',
            charterHash: outcome.charterHash,
            model: outcome.models.creator,
          }),
        ),
      );
    }

    let rejectionsStored = 0;
    for (const entry of outcome.rejected) {
      await this.rejectionRepo.save(
        this.rejectionRepo.create({
          charterHash: outcome.charterHash,
          model:
            (entry.source === 'reviewer'
              ? outcome.models.reviewer
              : outcome.models.creator) ?? 'unknown',
          tier: entry.task.tier,
          slug: normaliseSlug(entry.task.slug),
          brief: entry.task.brief,
          categories:
            entry.source === 'reviewer'
              ? (entry.review?.blockedTypes ?? [])
              : entry.violations.map((v) => v.category),
          violations:
            entry.source === 'reviewer'
              ? [entry.review ?? {}]
              : entry.violations,
          source: entry.source,
          feedback: entry.feedback,
          round: entry.round,
        }),
      );
      rejectionsStored++;
    }

    if (skipped.length > 0) {
      this.logger.log(
        `Filed ${saved.length} drafts, skipped ${skipped.length} taken slugs: ${skipped.join(', ')}`,
      );
    }

    return { saved, skipped, rejectionsStored };
  }

  /**
   * The tasks a player can pick from: approved only, and only the fields a
   * player needs. `rationale`, `charterHash` and who approved it are the
   * operator's business.
   */
  async playable(
    options: { tier?: number; mode?: TaskMode } = {},
  ): Promise<PlayableTask[]> {
    const where: Record<string, unknown> = { status: 'approved' };
    if (options.tier !== undefined) where.tier = options.tier;
    if (options.mode !== undefined) where.mode = options.mode;
    const rows = await this.templateRepo.find({
      where,
      order: { tier: 'ASC', title: 'ASC' },
      take: 200,
    });
    return rows.map((t) => ({
      id: t.id,
      slug: t.slug,
      tier: t.tier,
      title: t.title,
      brief: t.brief,
      proof: t.proof ?? 'either',
      mode: t.mode ?? 'solo',
      rewardNerve: t.rewardNerve ?? 0,
      rewardCoins: t.rewardCoins ?? 0,
      penaltyCoins: clampPenalty(t.penaltyCoins),
      clockMinutes: t.clockMinutes,
      guards: t.guards,
      criteria: t.criteria,
    }));
  }

  async get(id: string): Promise<GameTaskTemplate> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  list(options: { status?: TemplateStatus; tier?: number } = {}) {
    const where: Record<string, unknown> = {};
    if (options.status) where.status = options.status;
    if (options.tier !== undefined) where.tier = options.tier;
    return this.templateRepo.find({
      where,
      order: { tier: 'ASC', createdAt: 'DESC' },
      take: 200,
    });
  }

  /**
   * Approves a draft.
   *
   * **Re-screened at the moment of approval, not trusted from generation time.**
   * A template can be edited between the two, and the Charter can move — so the
   * check that matters is the one against the rules in force now, and a task
   * that no longer passes is refused with the reason rather than waved through
   * on the strength of an older verdict.
   *
   * The transition is claimed with a conditional UPDATE, so two reviewers
   * opening the same draft cannot both approve it.
   */
  async approve(id: string, approver: User): Promise<GameTaskTemplate> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    if (template.status === 'approved') {
      throw new ConflictException('That task is already approved.');
    }

    const verdict = screen({
      brief: template.brief,
      guards: template.guards,
      criteria: template.criteria,
    });
    if (!verdict.ok) {
      throw new BadRequestException(
        `The safety screen refuses this task: ${verdict.violations
          .map((v) => `${v.category} — ${v.remedy}`)
          .join('; ')}`,
      );
    }
    // The reviewer's no stands until the task is edited and reviewed again.
    if (template.review?.verdict === 'reject') {
      throw new BadRequestException(
        `The reviewer rejected this task (${template.review.blockedTypes.join(', ') || template.review.severity}): ${
          template.review.feedback ?? template.review.reasons.join(' ')
        }. Edit it and run the review again before approving.`,
      );
    }

    const claimed = rowsAffected(
      await this.templateRepo.query<unknown[]>(
        `UPDATE "game_task_templates"
            SET "status" = 'approved', "approvedAt" = now(), "approvedBy" = $2
          WHERE "id" = $1 AND "status" <> 'approved'
          RETURNING "id"`,
        [id, approver.id],
      ),
    );
    if (claimed === 0) {
      throw new ConflictException('That task was approved by someone else.');
    }

    const fresh = await this.templateRepo.findOne({ where: { id } });
    return fresh ?? template;
  }

  /** Stores a reviewer verdict on a template, from a fresh review. */
  async recordReview(
    id: string,
    verdict: ReviewVerdict,
  ): Promise<GameTaskTemplate> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    const review: TaskReview = {
      verdict: verdict.verdict,
      severity: verdict.severity,
      blockedTypes: verdict.blockedTypes,
      reasons: verdict.reasons,
      feedback: verdict.feedback,
      model: verdict.model,
      reviewedAt: verdict.reviewedAt,
      round: 0,
    };
    template.review = review;
    return this.templateRepo.save(template);
  }

  /**
   * Takes a task out of the pool.
   *
   * Retired rather than deleted: an attempt handed in against it keeps its
   * meaning, and a task that turned out badly is worth being able to look at
   * afterwards.
   */
  async retire(id: string): Promise<GameTaskTemplate> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    template.status = 'retired';
    return this.templateRepo.save(template);
  }

  /** The slugs a generator should be told to avoid. */
  async existingSlugs(): Promise<string[]> {
    const rows = await this.templateRepo.find({ select: { slug: true } });
    return rows.map((r) => r.slug);
  }

  /**
   * How the current Charter is doing.
   *
   * The number worth watching is the rejection rate per category: a rule that
   * never fires is either unnecessary or broken, and a rule that fires on most
   * generations means the Charter is not carrying it.
   */
  async stats(charterHash: string): Promise<PoolStats> {
    const [generated, rejections] = await Promise.all([
      this.templateRepo.count({ where: { charterHash, origin: 'generated' } }),
      this.rejectionRepo.find({ where: { charterHash }, take: 1000 }),
    ]);

    const byCategory: Record<string, number> = {};
    for (const rejection of rejections) {
      for (const category of rejection.categories) {
        byCategory[category] = (byCategory[category] ?? 0) + 1;
      }
    }

    return {
      charterHash,
      generated,
      rejected: rejections.length,
      byCategory,
    };
  }
}

/** Lowercase, hyphenated, bounded. The model's slug is a suggestion. */
export function normaliseSlug(raw: string): string {
  const slug = (raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'untitled';
}
