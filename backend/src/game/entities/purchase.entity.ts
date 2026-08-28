import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { CoinLedgerEntry } from './coin-ledger.entity';
import { Item } from './item.entity';

export type PurchaseKind = 'item' | 'coin_pack';

/**
 * The receipt. Written in the same transaction as its ledger debit and its
 * inventory row, so the three either all exist or none do.
 *
 * `orderId` is the bridge to the shop when coins were bought with money: the
 * existing TBC/BOG card providers take the payment, an order records it, and a
 * `coin_pack` ledger credit follows. That is why a purchase can have no item.
 */
@Entity('game_purchases')
@Unique('UQ_game_purchases_idempotency', ['idempotencyKey'])
@Index('IDX_game_purchases_user', ['userId', 'createdAt'])
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => Item, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'itemId' })
  item: Item | null;

  @Column({ type: 'uuid', nullable: true })
  itemId: string | null;

  @Column({ type: 'varchar', length: 16, default: 'item' })
  kind: PurchaseKind;

  @Column({ type: 'int', default: 0 })
  priceCoins: number;

  @ManyToOne(() => CoinLedgerEntry, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ledgerEntryId' })
  ledgerEntry: CoinLedgerEntry;

  @Column('uuid')
  ledgerEntryId: string;

  /** The shop order that paid for a coin pack, when money was involved. */
  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ type: 'varchar', length: 160 })
  idempotencyKey: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
