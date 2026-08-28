import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

/**
 * Offsets are hardware, not taste, so they are stored per device class rather
 * than per user. A phone on Bluetooth and a desktop on wired output need
 * numbers hundreds of milliseconds apart; one shared row makes the game feel
 * broken on whichever device was calibrated second.
 */
export type DeviceClass = 'desktop' | 'mobile' | 'tablet';

export type LaneColorMode =
  'default' | 'highContrast' | 'deuteranopia' | 'protanopia';

/** Lane index to the key codes bound to it. */
export type Keybinds = Partial<Record<'0' | '1' | '2' | '3', string[]>>;

@Entity('game_user_settings')
@Unique('UQ_game_user_settings_device', ['userId', 'deviceClass'])
export class GameUserSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 16 })
  deviceClass: DeviceClass;

  /** Corrects when a sound is *heard*. Moves the judgement window. */
  @Column({ type: 'int', default: 0 })
  audioOffsetMs: number;

  /** Corrects when a frame is *seen*. Moves where notes are drawn. */
  @Column({ type: 'int', default: 0 })
  visualOffsetMs: number;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  keybinds: Keybinds;

  @Column({ type: 'double precision', default: 2.4 })
  scrollSpeed: number;

  @Column({ default: false })
  reducedMotion: boolean;

  @Column({ type: 'varchar', length: 24, default: 'default' })
  laneColorMode: LaneColorMode;

  /**
   * Null means never calibrated, which is what triggers the first-run flow —
   * deliberately distinct from "calibrated, and the answer was zero".
   */
  @Column({ type: 'timestamptz', nullable: true })
  calibratedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
