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
import { ProductVariant } from '../products/product-variant.entity';
import { Product } from '../products/product.entity';

/**
 * A cart row belongs to exactly one owner: a signed-in user, or an anonymous
 * browser holding the `stiff_cart` cookie. The database enforces that with
 * `CHK_cart_items_one_owner` plus one partial unique index per owner kind —
 * see `GuestCheckout1787174000000`. Neither is expressible as a TypeORM
 * decorator, which is why they live in the migration rather than here.
 */
@Entity('cart_items')
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  /** Opaque token from the `stiff_cart` cookie. Set only on anonymous carts. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  guestId: string | null;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column('uuid')
  productId: string;

  /**
   * The exact size this line is for, and where its stock is checked.
   *
   * Nullable only because the column was added to existing rows; every line
   * written since carries one. Reading stock through the variant rather than
   * re-resolving product + size is what keeps the check honest — a product
   * loaded without its variants relation would otherwise look sold out.
   */
  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'variantId' })
  variant: ProductVariant | null;

  @Column({ type: 'uuid', nullable: true })
  variantId: string | null;

  @Column('int')
  quantity: number;

  // Empty string (not NULL) so the unique constraint works — Postgres treats
  // NULLs as distinct in unique indexes.
  @Column({ type: 'varchar', default: '' })
  size: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
