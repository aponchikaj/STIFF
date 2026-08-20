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
import { User } from '../users/user.entity';
import { DiscountCode } from './discount-code.entity';

/**
 * One use of one code on one order.
 *
 * Exists so a per-buyer cap can be enforced for guests too — they have no
 * account, so the email is the only handle — and so a promotion can be audited
 * after the fact rather than inferred from a counter.
 */
@Entity('discount_redemptions')
export class DiscountRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DiscountCode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'codeId' })
  code: DiscountCode;

  @Index()
  @Column('uuid')
  codeId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  /** One code per order — enforced by a unique constraint, not convention. */
  @Column('uuid')
  orderId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  guestEmail: string | null;

  @Column({ type: 'int', default: 0 })
  amountCents: number;

  @CreateDateColumn()
  createdAt: Date;
}
