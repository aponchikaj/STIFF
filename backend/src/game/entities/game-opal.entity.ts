import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const OPAL_PACK_STATUSES = ['draft', 'live', 'archived'] as const;
export type OpalPackStatus = (typeof OPAL_PACK_STATUSES)[number];

/**
 * A bundle of opals sold for lari. Set and repriced from the game panel.
 *
 * Opals are the game's coins — the same `game_enrolments.coins` balance a
 * task pays into and the coin shop spends from. A pack is only the price
 * list; what was actually paid is snapshotted on the order, so repricing a
 * pack never reprices a purchase.
 */
@Entity('game_opal_packs')
@Index(['status', 'sortOrder'])
export class GameOpalPack {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  /** How many opals the buyer gets. Always at least one. */
  @Column({ type: 'int' })
  opals: number;

  /** Price in tetri (1 GEL = 100), the unit the shop's own prices use. */
  @Column({ type: 'int' })
  priceCents: number;

  /** A short tag on the card — "BEST VALUE", "+20%". Optional. */
  @Column({ type: 'varchar', length: 24, nullable: true })
  badge: string | null;

  @Column({ type: 'varchar', length: 12, default: 'draft' })
  status: OpalPackStatus;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export const OPAL_ORDER_STATUSES = ['pending', 'paid', 'failed'] as const;
export type OpalOrderStatus = (typeof OPAL_ORDER_STATUSES)[number];

/** Opals are only sold by card — there is nothing to deliver cash against. */
export const OPAL_PAYMENT_METHODS = ['card_tbc', 'card_bog'] as const;
export type OpalPaymentMethod = (typeof OPAL_PAYMENT_METHODS)[number];

/**
 * One attempt to buy a pack.
 *
 * Created `pending` before the acquirer is contacted, so there is always a
 * row to reconcile a callback against. It becomes `paid` exactly once — the
 * transition is a conditional UPDATE — and only that transition credits the
 * opals, so a replayed callback cannot pay twice.
 */
@Entity('game_opal_orders')
@Index(['userId', 'createdAt'])
@Index(['status', 'createdAt'])
export class GameOpalOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  /**
   * The season balance at checkout, re-pointed at settlement to wherever
   * the opals actually went (the live season's enrolment, if it changed in
   * between). Null only if that enrolment was later deleted.
   */
  @Column({ type: 'uuid', nullable: true })
  enrolmentId: string | null;

  @Column({ type: 'uuid', nullable: true })
  packId: string | null;

  /** Snapshots: what the buyer saw and agreed to. */
  @Column({ type: 'varchar', length: 60 })
  packName: string;

  @Column({ type: 'int' })
  opals: number;

  @Column({ type: 'int' })
  priceCents: number;

  @Column({ type: 'varchar', length: 16 })
  paymentMethod: OpalPaymentMethod;

  @Column({ type: 'varchar', length: 12, default: 'pending' })
  status: OpalOrderStatus;

  /** The acquirer's reference, or `test_…` when no money moved. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  reference: string | null;

  /** True when PAYMENTS_TEST_MODE settled it. Kept so reports can exclude it. */
  @Column({ type: 'boolean', default: false })
  testMode: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
