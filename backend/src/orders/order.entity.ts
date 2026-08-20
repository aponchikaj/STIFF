import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { OrderItem } from './order-item.entity';
import type { PaymentMethod, ShippingMethod } from './checkout.constants';

export type OrderCancelledBy = 'customer' | 'admin';

export type OrderStatus =
  'pending' | 'paid' | 'packed' | 'shipped' | 'delivered' | 'cancelled';

export interface ShippingAddress {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  line1?: string;
  line2?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  /**
   * Where to send the invoice when nobody signed in. Exactly one of `userId`
   * and `guestEmail` is always set — `CHK_orders_reachable` enforces it, so an
   * order can never end up with no way to reach the buyer.
   */
  @Column({ type: 'varchar', length: 180, nullable: true })
  guestEmail: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: ['pending', 'paid', 'packed', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
  })
  status: OrderStatus;

  @Column('int')
  totalCents: number;

  @Column({ type: 'varchar', length: 3, default: 'gel' })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: 'cod' })
  paymentMethod: PaymentMethod;

  @Column({ type: 'varchar', nullable: true })
  paymentIntentId: string | null;

  @Column({ type: 'varchar', length: 20, default: 'tbilisi' })
  shippingMethod: ShippingMethod;

  @Column({ type: 'int', default: 0 })
  shippingCents: number;

  @Column({ type: 'jsonb', nullable: true })
  shippingAddress: ShippingAddress | null;

  // ---------- shipment ----------

  @Column({ type: 'varchar', length: 60, nullable: true })
  trackingCarrier: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  trackingNumber: string | null;

  /** Where to follow the parcel. Sent with the shipped-status email. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  trackingUrl: string | null;

  /**
   * When it actually reached the customer.
   *
   * The returns window counts from here rather than from `updatedAt`, which
   * moves every time an admin touches the order and would silently reset or
   * expire someone's right to send something back.
   */
  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  // ---------- cancellation ----------

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  /**
   * Who called it off. Kept apart from `status` because "the customer changed
   * their mind" and "we could not fulfil this" need different follow-up, and
   * the status alone cannot tell them apart.
   */
  @Column({ type: 'varchar', length: 10, nullable: true })
  cancelledBy: OrderCancelledBy | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
