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
import type { AttemptKind, SeasonDay } from '../media-rules';
import { GameEnrolment } from './game-enrolment.entity';
import { GameSeason } from './game-season.entity';

export type AttemptStatus =
  'awaiting_upload' | 'submitted' | 'published' | 'rejected';

/**
 * One player's proof for one day: a photo or a clip, and nothing live.
 *
 * The row is written *before* the file exists. The browser asks for an upload
 * URL, gets a row in `awaiting_upload`, `PUT`s the bytes straight to object
 * storage and then confirms — so the object key is decided by the server and
 * an abandoned upload leaves a row that can be swept, rather than a file
 * nothing points at.
 *
 * Media never passes through this app. `objectKey` is what the server minted;
 * `mediaUrl` is where the CDN serves it from. See `docs/game/hosting.md` for
 * why that split is what keeps a season's bill in single digits.
 */
@Entity('game_attempts')
@Unique('UQ_game_attempts_enrolment_day', ['enrolmentId', 'day'])
@Index(['seasonId', 'status'])
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

  /** 1, 2 or 3. One attempt per day, enforced by the unique constraint. */
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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
