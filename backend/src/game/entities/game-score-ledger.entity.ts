import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GameEnrolment } from './game-enrolment.entity';

export const SCORE_REASONS = [
  'task_reward',
  'clawback',
  'cheating',
  'reinstated',
  'admin',
  'opening',
] as const;
export type ScoreReason = (typeof SCORE_REASONS)[number];

/**
 * Every point of Nerve that moved, and why.
 *
 * Append-only, like the coin ledger beside it. `game_enrolments.nerve` is the
 * running total the board reads; this is the record it is derived from, and
 * the two are written in the same transaction, so at any moment
 * `SUM(delta)` over an enrolment's rows equals its score.
 *
 * The score is what ranks the season, which is why it gets a ledger of its
 * own rather than a column on the coin one: a coin is spent and forgotten,
 * but a Nerve point that moves after the fact reorders a board people have
 * already seen, and there has to be a row that says who moved it and for
 * what. That is what makes a clawback (`clawback`, when a verdict is
 * overturned) or a correction (`admin`) defensible rather than a number
 * that changed.
 *
 * `delta` is what actually moved, not what was asked: a clawback larger than
 * the score writes the score, because Nerve never goes below zero.
 * `opening` is written once by the migration that created the table, for an
 * enrolment that already had Nerve before there was a ledger to hold it.
 */
@Entity('game_score_ledger')
@Index(['enrolmentId', 'createdAt'])
@Index(['refType', 'refId'])
export class GameScoreLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => GameEnrolment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'enrolmentId' })
  enrolment: GameEnrolment;

  @Index()
  @Column('uuid')
  enrolmentId: string;

  @Column({ type: 'int' })
  delta: number;

  @Column({ type: 'int' })
  scoreAfter: number;

  @Column({ type: 'varchar', length: 24 })
  reason: ScoreReason;

  /** What it was for: an attempt, an admin action, the migration. */
  @Column({ type: 'varchar', length: 24, nullable: true })
  refType: string | null;

  @Column({ type: 'uuid', nullable: true })
  refId: string | null;

  /** Who moved it: `ai`, `resolver`, `sweep`, an admin's id, or `migration`. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  by: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
