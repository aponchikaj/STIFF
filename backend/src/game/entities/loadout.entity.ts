import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import type { ItemType } from './item.entity';
import { Item } from './item.entity';

/**
 * One row per equipped slot, not a wide table with a column per slot.
 *
 * This is the forward compatibility the shop design calls for: when skeletal
 * rigging makes `hat` and `accessory` real slots, they are new rows and a
 * widened CHECK — not a migration that rewrites everyone's loadout.
 */
@Entity('game_loadouts')
@Unique('UQ_game_loadouts_user_slot', ['userId', 'slot'])
export class Loadout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  userId: string;

  /** Matches `ItemType` today; the two diverge when part slots arrive. */
  @Column({ type: 'varchar', length: 32 })
  slot: ItemType;

  @ManyToOne(() => Item, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'itemId' })
  item: Item;

  @Column('uuid')
  itemId: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
