import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

/**
 * Payout curves, daily caps and diminishing-returns settings.
 *
 * Config rows rather than constants in code, so retuning the economy is an
 * admin action with an audit trail instead of a deploy.
 */
@Entity('game_economy_config')
export class EconomyConfig {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'updatedBy' })
  editor: User | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

export type FlagEnvironment =
  'development' | 'stage' | 'pre-prod' | 'production';

/**
 * Per-environment so a flag can be on in staging and off in production without
 * two rows fighting over one key.
 */
@Entity('game_feature_flags')
@Unique('UQ_game_feature_flags_key_env', ['key', 'environment'])
export class FeatureFlag {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'varchar', length: 16, default: 'production' })
  environment: FlagEnvironment;

  @Column({ default: false })
  enabled: boolean;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'updatedBy' })
  editor: User | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
