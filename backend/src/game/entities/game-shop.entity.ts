import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { GameEnrolment } from './game-enrolment.entity';

export const SHOP_ITEM_STATUSES = ['draft', 'live', 'archived'] as const;
export type ShopItemStatus = (typeof SHOP_ITEM_STATUSES)[number];

/**
 * Something the game sells for coins. Uploaded by an admin from the panel.
 *
 * Not a shop product: the shop sells clothes for lari and this sells
 * whatever the season offers — merch, a skin, a place at the final — for
 * the coins the game mints. `stock` null means unlimited.
 */
@Entity('game_shop_items')
@Index(['status', 'sortOrder'])
export class GameShopItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 600, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'int' })
  priceCoins: number;

  /** Null is unlimited. Counted down on every purchase, never below zero. */
  @Column({ type: 'int', nullable: true })
  stock: number | null;

  /** Purchases per enrolment; null is unlimited. */
  @Column({ type: 'int', nullable: true })
  perPersonLimit: number | null;

  @Column({ type: 'varchar', length: 12, default: 'draft' })
  status: ShopItemStatus;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export const PURCHASE_STATUSES = ['paid', 'fulfilled', 'cancelled'] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

/**
 * One purchase. The price is snapshotted: an item repriced later does not
 * reprice what was already bought, and the ledger row that paid for it
 * points here through `refId`.
 */
@Entity('game_purchases')
@Index(['enrolmentId', 'createdAt'])
@Index(['itemId', 'enrolmentId'])
export class GamePurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => GameShopItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'itemId' })
  item: GameShopItem;

  @Index()
  @Column('uuid')
  itemId: string;

  @ManyToOne(() => GameEnrolment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'enrolmentId' })
  enrolment: GameEnrolment;

  @Column('uuid')
  enrolmentId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 80 })
  itemName: string;

  @Column({ type: 'int' })
  priceCoins: number;

  @Column({ type: 'varchar', length: 12, default: 'paid' })
  status: PurchaseStatus;

  /** What the admin wrote when fulfilling or cancelling. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
