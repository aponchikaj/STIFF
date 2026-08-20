import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProductVariant } from './product-variant.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column('int')
  priceCents: number;

  @Column({ type: 'text', array: true, default: '{}' })
  images: string[];

  /**
   * Descriptions of `images`, aligned by index.
   *
   * A shorter array simply means the trailing photos have no description yet —
   * the alternative, rewriting `images` as jsonb objects, would break every
   * branch and every stored row that reads it as text[].
   */
  @Column({ type: 'text', array: true, default: '{}' })
  imageAlts: string[];

  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  sizes: string[];

  /**
   * Sum of every variant's stock, maintained on write.
   *
   * Denormalised on purpose: browsing sorts and filters on it, and a join per
   * row to add up variants would be the most expensive query on the site.
   * `ProductVariant.stock` is the source of truth.
   */
  @Column({ type: 'int', default: 0 })
  stock: number;

  @OneToMany(() => ProductVariant, (variant) => variant.product)
  variants: ProductVariant[];

  @Column({ default: true })
  isActive: boolean;

  /**
   * When the drop opens.
   *
   * A product is only visible once this has passed AND `isActive` is on, so a
   * scheduled piece cannot leak early by someone ticking the box first.
   */
  @Column({ type: 'timestamptz', nullable: true })
  publishAt: Date | null;

  @Column({ default: false })
  preorderEnabled: boolean;

  /** What the customer is promised. Shown on the product and the receipt. */
  @Column({ type: 'date', nullable: true })
  preorderShipsAt: string | null;

  /** Units sellable beyond real stock. 0 means none, never unlimited. */
  @Column({ type: 'int', default: 0 })
  preorderLimit: number;

  @Column({ type: 'int', default: 0 })
  likeCount: number;

  @Column({ type: 'int', default: 0 })
  dislikeCount: number;

  @Column({ type: 'int', default: 0 })
  commentCount: number;

  /**
   * Fit ratings, tallied per bucket.
   *
   * Denormalised the same way `likeCount` is: the grid would otherwise need a
   * grouped subquery per row. `product_fit_ratings` is the source of truth and
   * every write recounts from it.
   */
  @Column({ type: 'int', default: 0 })
  fitSmallCount: number;

  @Column({ type: 'int', default: 0 })
  fitTrueCount: number;

  @Column({ type: 'int', default: 0 })
  fitLargeCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
