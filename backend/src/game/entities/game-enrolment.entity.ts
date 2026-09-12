import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { GameSeason } from './game-season.entity';

export const ENROLMENT_ROLES = ['player', 'watcher'] as const;
export type EnrolmentRole = (typeof ENROLMENT_ROLES)[number];

export const ENROLMENT_STATUSES = ['active', 'demoted', 'cheater'] as const;
/**
 * `active` is the ordinary state. The other two are both watchers now, and
 * differ in what the feed says about them: a `demoted` player simply missed
 * the bar; a `cheater` is labelled as one on every comment they write.
 */
export type EnrolmentStatus = (typeof ENROLMENT_STATUSES)[number];

export const DEMOTION_REASONS = [
  'cheating',
  'missed_daily_minimum',
  'zero_balance',
  'out_of_hearts',
] as const;
export type DemotionReason = (typeof DEMOTION_REASONS)[number];

/** What was on the account the moment it was zeroed, so a mistake can be undone. */
export interface DemotionSnapshot {
  nerve: number;
  heartsRemaining: number;
  coins?: number;
  /** The attempt that triggered it, when one did. */
  attemptId?: string;
  /** `ai` or the admin's user id. */
  by: string;
}

/**
 * One account's place in one season, and the side it picked.
 *
 * **A person chooses the role once and cannot change it themselves.** A player
 * who could switch to watcher after a bad day would be voting on the field
 * they just left; a watcher who could switch to player mid-season would skip
 * the qualifier everyone else had to pass. `UQ_game_enrolments_season_user`
 * is what makes "cannot be both" a fact rather than a hope.
 *
 * **The game can change it, one way.** Four things move a player to watcher
 * and nothing moves a watcher to player: a confident cheating verdict, fewer
 * than the daily minimum of tasks handed in, reaching zero on everything, or
 * losing the last heart — to a decline or to a clock that hit zero.
 * `status` and `demotionReason` say which, `demotedAt` says when, and
 * `demotionSnapshot` is what an admin restores from if the call was wrong.
 * See `DisciplineService`.
 *
 * Hearts and Nerve live here rather than on the account for the same reason
 * the role does: they are facts about a season, and next season starts clean.
 */
@Entity('game_enrolments')
@Unique('UQ_game_enrolments_season_user', ['seasonId', 'userId'])
@Index(['seasonId', 'role'])
@Index(['seasonId', 'status'])
export class GameEnrolment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => GameSeason, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seasonId' })
  season: GameSeason;

  @Index()
  @Column('uuid')
  seasonId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 16 })
  role: EnrolmentRole;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: EnrolmentStatus;

  @Column({ type: 'timestamptz', nullable: true })
  demotedAt: Date | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  demotionReason: DemotionReason | null;

  @Column({ type: 'jsonb', nullable: true })
  demotionSnapshot: DemotionSnapshot | null;

  /**
   * The name the ladder and the feed show.
   *
   * Snapshotted from the account at enrolment rather than joined every read:
   * a season's leaderboard should still make sense after someone renames
   * themselves, and the feed is the hottest read in the game.
   */
  @Column({ type: 'varchar', length: 24 })
  handle: string;

  /** Spec §12. Ash never returns; this only ever counts down. */
  @Column({ type: 'int', default: 3 })
  heartsRemaining: number;

  @Column({ type: 'int', default: 3 })
  heartsTotal: number;

  /**
   * Spec §06. The score. Never bought, never spent, never below zero. Every
   * change to it is a row in `game_score_ledger`, written in the same
   * transaction, and this column is the running total of those rows.
   */
  @Index()
  @Column({ type: 'int', default: 0 })
  nerve: number;

  /**
   * Coins. Earned by finishing tasks, lost by failing team ones. The number
   * here is a cache of `SUM(delta)` over `game_coin_ledger` for this
   * enrolment; the ledger is the record, this is what the screen reads.
   */
  @Column({ type: 'int', default: 0 })
  coins: number;

  /**
   * When this watcher was last paid for a vote. A paid vote starts a
   * cooldown (`VOTE_WIN_COOLDOWN_HOURS`) during which further correct votes
   * earn nothing. Null until the first win.
   */
  @Column({ type: 'timestamptz', nullable: true })
  lastVoteWinAt: Date | null;

  /**
   * When this enrolment last earned Nerve.
   *
   * The leaderboard breaks ties on it, and the rule is published in advance:
   * whoever reached the score first is ahead. Null until the first point.
   */
  @Column({ type: 'timestamptz', nullable: true })
  lastScoredAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
