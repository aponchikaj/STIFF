import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { AttemptKind, SeasonDay } from '../media-rules';
import { GameEnrolment } from './game-enrolment.entity';
import { GameSeason } from './game-season.entity';
import { GameTaskTemplate } from './game-task-template.entity';

export type AttemptStatus =
  'awaiting_upload' | 'submitted' | 'published' | 'rejected';

export type CheatVerdictKind =
  'authentic' | 'suspicious' | 'cheating' | 'unchecked';

/**
 * What the cheat detector concluded about one attempt, kept on the row.
 *
 * `unchecked` is a verdict too: it says the model was not asked (no key, a
 * clip rather than a still, the call failed) so a reviewer knows the item was
 * never looked at rather than looked at and passed. `enforced` records whether
 * anything moved on its word — in shadow mode nothing does.
 */
export interface CheatVerdict {
  verdict: CheatVerdictKind;
  /** 0–1. Zero when `unchecked`. */
  confidence: number;
  reasons: string[];
  /** What the model saw that led it there — screenshot, ai_generated, and so on. */
  signals?: string[];
  model: string | null;
  checkedAt: string;
  mode: 'enforce' | 'shadow' | 'off';
  enforced: boolean;
  /** Why the model was not asked, when it was not. */
  skipped?: 'video' | 'not_configured' | 'no_media' | 'error' | 'disabled';
}

export const VOTING_STATUSES = [
  'none',
  'open',
  'resolving',
  'deferred',
  'resolved',
] as const;
/**
 * `open` — watchers may vote until `votingEndsAt`.
 * `resolving` — the window closed and the resolver is looking (claimed).
 * `deferred` — the resolver could not say; a person settles, and voters
 *   are paid then.
 * `resolved` — done, one way or the other; `voting` says which.
 */
export type VotingStatus = (typeof VOTING_STATUSES)[number];

/** What the vote resolver concluded, kept on the row. */
export interface VotingResolution {
  outcome: 'confirmed' | 'not_confirmed' | 'unsure';
  confidence: number;
  /** Coins each correct "yes" voter was paid. Within the rule's range. */
  payout: number;
  reasons: string[];
  model: string | null;
  /** `resolver`, or the admin's id when a person settled it. */
  by: string;
  resolvedAt: string;
  yes: number;
  no: number;
  /** How many voters were paid, and how many were in cooldown. */
  paid: number;
  cooling: number;
}

/**
 * One player's proof for one task: a photo or a clip, and nothing live.
 *
 * The row is written *before* the file exists. The browser asks for an upload
 * URL, gets a row in `awaiting_upload`, `PUT`s the bytes straight to object
 * storage and then confirms — so the object key is decided by the server and
 * an abandoned upload leaves a row that can be swept, rather than a file
 * nothing points at.
 *
 * **There is no cap on attempts per day, and there is a floor.** A player
 * hands in as many tasks as they like; fewer than the daily minimum on a day
 * the season was running moves them to watcher overnight. `submittedAt` is
 * the timestamp that counts for that — the confirm, not the reservation.
 *
 * Media never passes through this app. `objectKey` is what the server minted;
 * `mediaUrl` is where the CDN serves it from. See `docs/game/hosting.md` for
 * why that split is what keeps a season's bill in single digits.
 */
@Entity('game_attempts')
@Index(['seasonId', 'status'])
@Index(['enrolmentId', 'submittedAt'])
export class GameAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => GameSeason, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seasonId' })
  season: GameSeason;

  @Index()
  @Column('uuid')
  seasonId: string;

  @ManyToOne(() => GameEnrolment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'enrolmentId' })
  enrolment: GameEnrolment;

  @Index()
  @Column('uuid')
  enrolmentId: string;

  /**
   * The task this is proof of, when the player said which.
   *
   * Nullable because a season may be played from a brief handed out some
   * other way; when it is set, the cheat detector reads the brief and its
   * criteria and judges the footage against them rather than in the abstract.
   */
  @ManyToOne(() => GameTaskTemplate, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'taskTemplateId' })
  taskTemplate: GameTaskTemplate | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  taskTemplateId: string | null;

  /**
   * The accepted assignment this is the hand-in for. Every upload opens
   * against one, and the confirm is what closes it — in time, or not.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  assignmentId: string | null;

  /** 1, 2 or 3 — the rung of the ladder this was handed in on. */
  @Column({ type: 'smallint' })
  day: SeasonDay;

  @Column({ type: 'varchar', length: 8 })
  kind: AttemptKind;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'awaiting_upload' })
  status: AttemptStatus;

  /** Server-minted. Never taken from the client's filename. */
  @Column({ type: 'varchar', length: 400 })
  objectKey: string;

  /** Filled in on confirm; null while the upload is still outstanding. */
  @Column({ type: 'varchar', length: 600, nullable: true })
  mediaUrl: string | null;

  @Column({ type: 'varchar', length: 60 })
  mimeType: string;

  @Column({ type: 'bigint', default: 0 })
  byteSize: number;

  /** Whole seconds for a clip; null for a still. Between 5 and 120. */
  @Column({ type: 'int', nullable: true })
  durationSeconds: number | null;

  @Column({ type: 'int', nullable: true })
  width: number | null;

  @Column({ type: 'int', nullable: true })
  height: number | null;

  @Column({ type: 'varchar', length: 280, nullable: true })
  caption: string | null;

  /** When the upload was confirmed. This is what the daily minimum counts. */
  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  // -------------------------------------------------------- the verdicts --

  @Column({ type: 'jsonb', nullable: true })
  aiVerdict: CheatVerdict | null;

  @Column({ type: 'timestamptz', nullable: true })
  aiCheckedAt: Date | null;

  /** Why it was rejected, when it was — by the model or by a person. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  rejectionReason: string | null;

  // ---------------------------------------------------------- the vote --

  @Index()
  @Column({ type: 'varchar', length: 12, default: 'none' })
  votingStatus: VotingStatus;

  /** `submittedAt + VOTING_WINDOW_HOURS`. Null when no vote was opened. */
  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  votingEndsAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  voting: VotingResolution | null;

  // ---------- denormalised counters, recounted from their tables ----------

  @Column({ type: 'int', default: 0 })
  likeCount: number;

  @Column({ type: 'int', default: 0 })
  commentCount: number;

  /**
   * Shares are counted, not stored per person.
   *
   * The share sheet hands a generated image to the OS — there is no callback
   * telling us it reached Instagram, so a per-user row would record intent and
   * pretend it was reach. A counter is honest about being a tally of taps.
   */
  @Column({ type: 'int', default: 0 })
  shareCount: number;

  /** When it entered the feed. Null until a verdict publishes it. */
  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  /**
   * Taken out of the feed without a verdict, because enough different
   * people reported it (`ReportsService`). Still `published`, still counted;
   * an admin resolving the reports either restores it or unpublishes it
   * properly. Null is the ordinary state.
   */
  @Column({ type: 'timestamptz', nullable: true })
  hiddenAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
