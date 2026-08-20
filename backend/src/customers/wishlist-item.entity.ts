import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';

/**
 * One saved piece.
 *
 * Not a `Reaction` with a third type: a like is public and drives the popular
 * sort, a save is private intent. `UQ_wishlist_items_user_product` makes
 * saving twice the same as saving once.
 */
@Entity('wishlist_items')
export class WishlistItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column('uuid')
  userId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column('uuid')
  productId: string;

  @CreateDateColumn()
  createdAt: Date;
}
