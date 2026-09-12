import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { SeasonDay } from '../media-rules';

export type TemplateStatus = 'draft' | 'approved' | 'retired';

/** Where the brief came from. Generated ones carry the Charter that wrote them. */
export type TemplateOrigin = 'human' | 'generated';

export const TASK_MODES = ['solo', 'team'] as const;
/** Who a task is for: one player, or a clan of two. */
export type TaskMode = (typeof TASK_MODES)[number];

export const TASK_PROOFS = ['photo', 'video', 'either'] as const;
/** How a task is proved: a still, a clip, or the player's choice. */
export type TaskProof = (typeof TASK_PROOFS)[number];

/** What the reviewer agent concluded about this task, kept on the row. */
export interface TaskReview {
  verdict: 'approve' | 'reject';
  severity: 'ok' | 'bad' | 'illegal';
  /** Ids from `BLOCKED_TASK_TYPES`. */
  blockedTypes: string[];
  reasons: string[];
  /** What the creator was told to change, when rejected. */
  feedback: string | null;
  model: string | null;
  reviewedAt: string;
  /** Which round of the creator/reviewer loop produced this verdict. */
  round: number;
}

export interface TemplateCriterion {
  id: string;
  modality: string;
  required: boolean;
  assert: string;
}

/**
 * One task the game can hand out — the pool, not an instance.
 *
 * Templates are pool-wide rather than season-scoped: a task that worked is
 * worth running again, and scoping the pool to a season would mean rewriting
 * twenty-two of them every time one starts.
 *
 * **A generated template lands as `draft` and nothing publishes it but a
 * person.** `charterHash` records which version of the safety rules wrote it,
 * so a Charter edit is auditable in the data — you can ask "which live tasks
 * were written under the old rules" and get an answer.
 */
@Entity('game_task_templates')
@Index(['status', 'tier'])
export class GameTaskTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Column({ type: 'smallint' })
  tier: SeasonDay;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  /** What the player actually reads while the clock runs. */
  @Column({ type: 'text' })
  brief: string;

  @Column({ type: 'int' })
  clockMinutes: number;

  /** Stated in the brief too; enforced when the player opens an upload. */
  @Column({ type: 'varchar', length: 8, default: 'either' })
  proof: TaskProof;

  /** `solo` is drawn by a player; `team` only by a clan's leader. */
  @Index()
  @Column({ type: 'varchar', length: 8, default: 'solo' })
  mode: TaskMode;

  /** What finishing it pays, to each person who did it. */
  @Column({ type: 'int', default: 0 })
  rewardNerve: number;

  @Column({ type: 'int', default: 0 })
  rewardCoins: number;

  /** What failing a team task costs each member: 1 to 3 coins. */
  @Column({ type: 'smallint', default: 1 })
  penaltyCoins: number;

  /**
   * The reviewer agent's verdict. Null for a task nobody has run it on.
   * A rejected task cannot be approved until it is edited and re-reviewed.
   */
  @Column({ type: 'jsonb', nullable: true })
  review: TaskReview | null;

  /** Enforced in the brief's wording *and* by the safety screen. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  guards: string[];

  /** What a verifier checks against the footage. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  criteria: TemplateCriterion[];

  @Column({ type: 'text', nullable: true })
  rationale: string | null;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: TemplateStatus;

  @Column({ type: 'varchar', length: 16, default: 'human' })
  origin: TemplateOrigin;

  /**
   * The Charter that wrote this, when a model did.
   *
   * Null for a hand-written task. Kept so "which live tasks predate the
   * current safety rules" is a query rather than an archaeology project.
   */
  @Index()
  @Column({ type: 'varchar', length: 16, nullable: true })
  charterHash: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  model: string | null;

  /** Who approved it, and when. Null while it is still a draft. */
  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
