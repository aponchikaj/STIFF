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
import { Order } from '../orders/order.entity';
import { ReturnRequestItem } from './return-request-item.entity';

export const RETURN_STATUSES = [
  'requested',
  'approved',
  'rejected',
  'received',
  'refunded',
] as const;

export type ReturnStatus = (typeof RETURN_STATUSES)[number];

/** Statuses that mean a claim is still live on the parcel. */
export const OPEN_RETURN_STATUSES: ReturnStatus[] = [
  'requested',
  'approved',
  'received',
];

@Entity('return_requests')
export class ReturnRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Index()
  @Column('uuid')
  orderId: string;

  @Column({ type: 'varchar', length: 12, default: 'requested' })
  status: ReturnStatus;

  /** The customer's words. Shown to whoever handles the request. */
  @Column({ type: 'text', default: '' })
  reason: string;

  /** The shop's answer — required when rejecting, so a refusal is explained. */
  @Column({ type: 'text', default: '' })
  resolutionNote: string;

  @Column({ type: 'int', default: 0 })
  refundCents: number;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @OneToMany(() => ReturnRequestItem, (item) => item.request, { cascade: true })
  items: ReturnRequestItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
