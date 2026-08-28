import type { BpmChange, ChartEvent, Difficulty, Note } from '@stiff/game-core';
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
import { Song } from './song.entity';

export type ChartStatus = 'draft' | 'approved' | 'archived';
export type ChartGenerator = 'ai' | 'manual' | 'imported';

/**
 * The note data itself is typed by `@stiff/game-core`, not re-declared here.
 * The engine, the scorer and this row therefore cannot disagree about what a
 * note is — which is the entire reason that package exists.
 *
 * A row is immutable once approved: an edit creates `version + 1` and archives
 * the old one, because runs point at a specific chart id and rewriting notes
 * underneath them would silently change what historical scores meant.
 */
@Entity('game_charts')
@Unique('UQ_game_charts_version', ['songId', 'difficulty', 'version'])
@Index('IDX_game_charts_chartHash', ['chartHash'])
export class Chart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Song, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'songId' })
  song: Song;

  @Column('uuid')
  songId: string;

  @Column({ type: 'varchar', length: 16 })
  difficulty: Difficulty;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  notes: Note[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  events: ChartEvent[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  bpmChanges: BpmChange[];

  @Column({ type: 'double precision', default: 2.4 })
  scrollSpeed: number;

  /** Hash of the playable content only — see `canonicalizeChart`. */
  @Column({ type: 'varchar', length: 64 })
  chartHash: string;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: ChartStatus;

  @Column({ type: 'varchar', length: 16, default: 'manual' })
  generatedBy: ChartGenerator;

  @Column({ type: 'varchar', length: 128, nullable: true })
  generatorModel: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  generatorPromptVersion: string | null;

  @Column({ type: 'double precision', default: 0 })
  npsPeak: number;

  @Column({ type: 'double precision', default: 0 })
  npsAvg: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'approvedBy' })
  approver: User | null;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
