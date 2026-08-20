import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductVariant } from '../products/product-variant.entity';
import { User } from '../users/user.entity';

/**
 * "Tell me when this size is back."
 *
 * Belongs to an account or to a bare email, never both — the same one-owner
 * CHECK as cart rows, so someone can ask without signing up. `notifiedAt` both
 * records the send and frees the unique index, letting the same person
 * subscribe again next time it sells out.
 */
@Entity('stock_alerts')
export class StockAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variantId' })
  variant: ProductVariant;

  @Index()
  @Column('uuid')
  variantId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  email: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  notifiedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
