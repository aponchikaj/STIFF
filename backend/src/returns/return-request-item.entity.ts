import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderItem } from '../orders/order-item.entity';
import { ReturnRequest } from './return-request.entity';

/** One order line, and how much of it is coming back. */
@Entity('return_request_items')
export class ReturnRequestItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ReturnRequest, (request) => request.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'returnRequestId' })
  request: ReturnRequest;

  @Column('uuid')
  returnRequestId: string;

  @ManyToOne(() => OrderItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderItemId' })
  orderItem: OrderItem;

  @Column('uuid')
  orderItemId: string;

  @Column('int')
  quantity: number;
}
