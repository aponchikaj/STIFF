import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { Chart } from './chart.entity';

export type RejectionReason =
  | 'chart_hash_mismatch'
  | 'score_mismatch'
  | 'too_fast'
  | 'superhuman_consistency'
  | 'token_reused'
  | 'token_expired'
  | 'token_unknown'
  | 'malformed_input_log';

export type RejectionAction = 'dismissed' | 'voided' | 'suspended';

/**
 * A queue for a human, not an enforcement mechanism.
 *
 * Nothing here bans anyone. Statistical cheat detection has false positives,
 * and wrongly banning a good player costs far more than a slow review does.
 */
@Entity('game_run_rejections')
@Index('IDX_game_run_rejections_user', ['userId', 'createdAt'])
export class RunRejection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => Chart, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'chartId' })
  chart: Chart | null;

  @Column({ type: 'uuid', nullable: true })
  chartId: string | null;

  @Column({ type: 'uuid', nullable: true })
  runTokenId: string | null;

  @Column({ type: 'varchar', length: 32 })
  reason: RejectionReason;

  /** Whatever the check saw. Shaped per reason, hence jsonb. */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  detail: Record<string, unknown>;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewedBy' })
  reviewer: User | null;

  @Column({ type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  action: RejectionAction | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
