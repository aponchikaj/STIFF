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

export type CoinReason =
  | 'task_reward'
  | 'task_penalty'
  | 'vote_reward'
  | 'purchase'
  | 'cheating'
  | 'reinstated'
  | 'admin';

/**
 * Every coin that moved, and why.
 *
 * Append-only. `game_enrolments.coins` is the running total kept alongside
 * for reads; this is the record it is derived from, and the two are written
 * in the same transaction. There is no endpoint that edits or deletes a row.
 *
 * `delta` is what actually moved, not what was asked: a three-coin penalty
 * on a one-coin balance writes -1, because a balance never goes below zero.
 */
@Entity('game_coin_ledger')
@Index(['enrolmentId', 'createdAt'])
export class GameCoinLedger {
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
  balanceAfter: number;

  @Column({ type: 'varchar', length: 24 })
  reason: CoinReason;

  /** What it was for: an assignment, an attempt, an admin action. */
  @Column({ type: 'varchar', length: 24, nullable: true })
  refType: string | null;

  @Column({ type: 'uuid', nullable: true })
  refId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
