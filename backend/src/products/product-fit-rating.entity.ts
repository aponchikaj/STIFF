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
import { User } from '../users/user.entity';
import { Product } from './product.entity';
import type { FitValue } from './fit';

/**
 * One buyer's answer to "how does it fit".
 *
 * `UQ_product_fit_ratings_product_user` makes this one reading per person per
 * piece — rating again edits the first rather than stuffing the ballot. The
 * `value IN (-1, 0, 1)` CHECK lives beside it in the migration.
 */
@Entity('product_fit_ratings')
export class ProductFitRating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Index()
  @Column('uuid')
  productId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  userId: string;

  /**
   * The size they wore, snapshotted.
   *
   * Kept as a label rather than a variant FK: the reading is still true after
   * that size is retired, and a retired variant is exactly the case where
   * knowing "the M ran small" matters most.
   */
  @Column({ type: 'varchar', length: 20, default: '' })
  size: string;

  /** -1 runs small, 0 true to size, 1 runs large. */
  @Column({ type: 'smallint' })
  value: FitValue;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
