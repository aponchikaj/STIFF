import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A task the safety screen refused, kept.
 *
 * The screen's job is to reject; this table is why rejecting is useful. A
 * rejection rate that climbs after a Charter edit is the first sign the edit
 * stopped holding, and a rate that is zero across hundreds of generations
 * usually means the screen has been weakened rather than that the model got
 * better. Neither is visible if the rejections only ever existed in an HTTP
 * response.
 *
 * Append-only by intent. There is no endpoint that edits or deletes a row,
 * and there should not be — the same reasoning as `admin_audit_logs`.
 */
@Entity('game_generation_rejections')
@Index(['charterHash', 'createdAt'])
export class GameGenerationRejection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The Charter in force when the model wrote this. */
  @Index()
  @Column({ type: 'varchar', length: 16 })
  charterHash: string;

  @Column({ type: 'varchar', length: 40 })
  model: string;

  @Column({ type: 'smallint' })
  tier: number;

  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Column({ type: 'text' })
  brief: string;

  /** The categories the screen tripped on, so rates can be counted per rule. */
  @Index()
  @Column({ type: 'jsonb' })
  categories: string[];

  /** The full violations, with the matched phrase and the remedy. */
  @Column({ type: 'jsonb' })
  violations: unknown[];

  /** Who refused it: the regex screen, or the reviewer agent. */
  @Index()
  @Column({ type: 'varchar', length: 16, default: 'screen' })
  source: 'screen' | 'reviewer';

  /** What the creator was told to change. */
  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  /** Which round of the loop this was. */
  @Column({ type: 'smallint', default: 1 })
  round: number;

  @CreateDateColumn()
  createdAt: Date;
}
