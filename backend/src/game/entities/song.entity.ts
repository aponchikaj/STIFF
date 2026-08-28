import type { AnalysisResult } from '@stiff/game-core';
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

export type SongStatus =
  'draft' | 'analyzing' | 'ready' | 'published' | 'archived';

export type SongSourceType = 'upload' | 'url';

/**
 * Stage A DSP output, reusable across all four difficulties of a song.
 *
 * The shape comes from `@stiff/game-core` rather than being re-declared here.
 * It was a local interface first, written before the analyser existed, and by
 * the time the pipeline was wired the two had already drifted — the column
 * would have accepted a shape the generator could not read.
 */
export type SongAnalysis = AnalysisResult;

@Entity('game_songs')
@Unique('UQ_game_songs_slug', ['slug'])
@Index('IDX_game_songs_status', ['status', 'createdAt'])
export class Song {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Stable identity for URLs and for idempotent seeding. */
  @Column({ type: 'varchar', length: 64 })
  slug: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 200 })
  artist: string;

  @Column({ type: 'text', nullable: true })
  credit: string | null;

  /**
   * Required, with no default. Where a track came from and what we may do
   * with it is the one thing that cannot be reconstructed after the fact.
   */
  @Column({ type: 'text' })
  licenseNote: string;

  @Column({ type: 'varchar', length: 16, default: 'upload' })
  sourceType: SongSourceType;

  @Column({ type: 'text', nullable: true })
  sourceUrl: string | null;

  @Column({ type: 'int' })
  durationMs: number;

  @Column({ type: 'double precision' })
  bpm: number;

  /** True once a human corrected the detected tempo; re-analysis must not undo it. */
  @Column({ default: false })
  bpmIsManual: boolean;

  /**
   * Separate objects because they are separate `AudioBufferSourceNode`s at
   * play time — ducking the player's vocal on a miss is impossible from a
   * pre-mixed file. `audioOpponentKey` is null when one vocal stem is shared.
   */
  @Column({ type: 'varchar', length: 512, nullable: true })
  audioInstKey: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  audioVoicesKey: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  audioOpponentKey: string | null;

  @Column({ type: 'int', default: 0 })
  previewStartMs: number;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: SongStatus;

  @Column({ type: 'jsonb', nullable: true })
  analysis: SongAnalysis | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdBy' })
  creator: User | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
