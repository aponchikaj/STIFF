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

  @Column({ type: 'int', default: 0 })
  likeCount: number;

  @Column({ type: 'int', default: 0 })
  dislikeCount: number;

  @Column({ type: 'int', default: 0 })
  commentCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
