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
import { GameCharacter } from './character.entity';

/**
 * v1 slots. Whole-skin swaps plus non-anchored cosmetics — no per-part
 * layering, because frame spritesheets cannot carry a hat that follows a head.
 *
 * Deliberately a union over a varchar rather than a Postgres enum: when
 * skeletal rigging makes `hat` and `accessory` real, adding them is one
 * widened CHECK and new rows, with no change to inventories anyone owns.
 */
export type ItemType =
  'skin' | 'noteSkin' | 'uiTheme' | 'namePlate' | 'hypeChar' | 'trail';

export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

/** e.g. `{ "rank": "S", "chartId": "..." }`. */
export type UnlockCondition = Record<string, string | number | boolean>;

@Entity('game_items')
@Unique('UQ_game_items_slug', ['slug'])
export class Item {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  slug: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 32 })
  type: ItemType;

  @Column({ type: 'varchar', length: 16, default: 'common' })
  rarity: ItemRarity;

  @Column({ type: 'int', default: 0 })
  priceCoins: number;

  /** Null means buyable. Non-null means earned, and price is irrelevant. */
  @Column({ type: 'jsonb', nullable: true })
  unlockCondition: UnlockCondition | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  assetRefs: Record<string, string>;

  /** Set for a `skin`: which character it re-skins. Null otherwise. */
  @ManyToOne(() => GameCharacter, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'characterId' })
  character: GameCharacter | null;

  @Column({ type: 'uuid', nullable: true })
  characterId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  availableFrom: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  availableUntil: Date | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
