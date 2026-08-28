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
import { numericTransformer } from './numeric.transformer';

export type Rank = 'P' | 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface JudgementCounts {
  sick: number;
  good: number;
  bad: number;
  shit: number;
  miss: number;
}

/**
 * Every column here is what the *server* decided after replaying the input
 * log. The client's reported score is compared and then discarded; a mismatch
 * produces a `RunRejection`, never a run.
 */
@Entity('game_runs')
@Index('IDX_game_runs_user_createdAt', ['userId', 'createdAt'])
export class Run {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => Chart, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'chartId' })
  chart: Chart;

  @Column('uuid')
  chartId: string;

  /**
   * Duplicated from the chart deliberately: this is the evidence of which
   * content the score was earned against, and it has to survive independently
   * of the row it came from.
   */
  @Column({ type: 'varchar', length: 64 })
  chartHash: string;

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

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  judgements: JudgementCounts;

  /** Wall-clock time the client took. A run faster than the music is not one. */
  @Column({ type: 'int' })
  elapsedMs: number;

  @Column({ default: false })
  validated: boolean;

  /** No-fail practice: never mints coins, never reaches a leaderboard. */
  @Column({ default: false })
  practiceMode: boolean;

  @Column({ type: 'varchar', length: 512, nullable: true })
  replayKey: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
