import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { Chart } from './chart.entity';
import { numericTransformer } from './numeric.transformer';
import type { Rank } from './run.entity';
import { Run } from './run.entity';

/**
 * Best run per user per chart, materialised.
 *
 * The unique constraint is the design: a better run updates the row rather
 * than inserting, so a board can never show one player twice. This table is
 * the source of truth — any Redis mirror added later is rebuilt from here and
 * never patched, so divergence always resolves in favour of Postgres.
 */
@Entity('game_leaderboard_entries')
@Unique('UQ_game_leaderboard_chart_user', ['chartId', 'userId'])
export class LeaderboardEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Chart, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chartId' })
  chart: Chart;

  @Column('uuid')
  chartId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => Run, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'runId' })
  run: Run;

  @Column('uuid')
  runId: string;

  @Column({ type: 'int' })
  score: number;

  @Column({
    type: 'numeric',
    precision: 6,
    scale: 3,
    transformer: numericTransformer,
  })
  accuracy: number;

  @Column({ type: 'int', default: 0 })
  maxCombo: number;

  @Column({ type: 'varchar', length: 2 })
  rank: Rank;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  achievedAt: Date;

  /** Removal is an admin action with a reason attached, never a silent delete. */
  @Column({ type: 'timestamptz', nullable: true })
  removedAt: Date | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'removedBy' })
  remover: User | null;

  @Column({ type: 'uuid', nullable: true })
  removedBy: string | null;

  @Column({ type: 'text', nullable: true })
  removalReason: string | null;
}
