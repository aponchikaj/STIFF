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

/**
 * One account's place in one season, and the side it picked.
 *
 * **The role is chosen once and cannot be changed.** A player who could switch
 * to watcher after a bad day would be voting on the field they just left, and
 * a watcher who could switch to player mid-season would skip the qualifier
 * everyone else had to pass. `UQ_game_enrolments_season_user` is what makes
 * "cannot be both" a fact rather than a hope.
 *
 * Hearts and Nerve live here rather than on the account for the same reason
 * the role does: they are facts about a season, and next season starts clean.
 */
@Entity('game_enrolments')
@Unique('UQ_game_enrolments_season_user', ['seasonId', 'userId'])
@Index(['seasonId', 'role'])
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

  /** Spec §06. Earned only — never bought, never spent. */
  @Index()
  @Column({ type: 'int', default: 0 })
  nerve: number;

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
