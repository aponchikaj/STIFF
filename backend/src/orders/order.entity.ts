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

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
