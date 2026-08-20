import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from '../orders/order.entity';
import { GiftCard } from './gift-card.entity';

/**
 * Every movement on a card.
 *
 * A balance alone cannot answer "where did my 40 GEL go" — this can, which is
 * what makes a partly-spent card disputable rather than a matter of trust.
 */
@Entity('gift_card_ledger')
export class GiftCardLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => GiftCard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'giftCardId' })
  giftCard: GiftCard;

  @Index()
  @Column('uuid')
  giftCardId: string;

  @ManyToOne(() => Order, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'orderId' })
  order: Order | null;

  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  /** Negative spends, positive refunds back onto the card. */
  @Column({ type: 'int' })
  amountCents: number;

  @Column({ type: 'varchar', length: 40, default: 'spend' })
  reason: string;

  @CreateDateColumn()
  createdAt: Date;
}
