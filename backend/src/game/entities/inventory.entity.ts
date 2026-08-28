import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { Item } from './item.entity';

export type AcquisitionSource = 'purchase' | 'grant' | 'unlock' | 'seed';

/**
 * Owning something is a fact, not a quantity: the unique constraint makes a
 * double grant a no-op rather than a duplicate to reconcile later.
 *
 * The item relation is RESTRICT — deleting an item someone paid for would
 * erase what their coins bought. Retiring it is `isActive = false`.
 */
@Entity('game_inventories')
@Unique('UQ_game_inventories_user_item', ['userId', 'itemId'])
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => Item, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'itemId' })
  item: Item;

  @Column('uuid')
  itemId: string;

  @Column({ type: 'varchar', length: 16, default: 'purchase' })
  source: AcquisitionSource;

  @CreateDateColumn({ type: 'timestamptz' })
  acquiredAt: Date;
}
