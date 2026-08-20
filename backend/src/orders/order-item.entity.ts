import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { ProductVariant } from '../products/product-variant.entity';
import { Product } from '../products/product.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column('uuid')
  orderId: string;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'productId' })
  product: Product | null;

  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  /**
   * Severed rather than cascaded when a variant is deleted — `size` below is
   * the snapshot that keeps the line readable, exactly like `productName`.
   */
  @ManyToOne(() => ProductVariant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'variantId' })
  variant: ProductVariant | null;

  @Column({ type: 'uuid', nullable: true })
  variantId: string | null;

  // Snapshots — order history must survive product edits/deletes.
  @Column()
  productName: string;

  @Column({ type: 'varchar', nullable: true })
  productImage: string | null;

  @Column('int')
  unitPriceCents: number;

  @Column('int')
  quantity: number;

  @Column({ type: 'varchar', default: '' })
  size: string;

  /** Snapshot of the colourway, for the same reason `size` is one. */
  @Column({ type: 'varchar', length: 40, default: '' })
  color: string;

  /**
   * This line was a pre-order when it was placed.
   *
   * Recorded on the line rather than inferred from the product, which stops
   * taking pre-orders eventually — the admin still needs to see what is owed.
   */
  @Column({ default: false })
  isPreorder: boolean;
}
