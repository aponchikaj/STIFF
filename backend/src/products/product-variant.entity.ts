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
import { Product } from './product.entity';

/**
 * One buyable size of a product, and the only stock of record.
 *
 * A product with no sizes still has exactly one variant, with `size = ''`, so
 * every read path deals in variants rather than branching on whether the
 * product happens to have sizes.
 *
 * `UQ_product_variants_product_size` and the `stock >= 0` CHECK live in
 * `ProductVariants1787175000000` — the partial unique index on `sku` has no
 * TypeORM decorator equivalent, so all three are kept together in the
 * migration rather than split across two places.
 */
@Entity('product_variants')
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, (product) => product.variants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Index()
  @Column('uuid')
  productId: string;

  /** Empty string for a one-size product — never null, so the unique index bites. */
  @Column({ type: 'varchar', length: 20, default: '' })
  size: string;

  /** Optional, but unique across the catalogue when set. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  sku: string | null;

  @Column({ type: 'int', default: 0 })
  stock: number;

  /** Added to the product price for this size — e.g. XXL costing more. */
  @Column({ type: 'int', default: 0 })
  priceDeltaCents: number;

  /** Admin's chosen order. Fractional so a row can be moved without a rewrite. */
  @Column({ type: 'double precision', default: 0 })
  position: number;

  /** A retired size stays for order history but stops being sellable. */
  @Column({ default: true })
  isActive: boolean;

  /** Sold against stock that does not exist yet — counted against the limit. */
  @Column({ type: 'int', default: 0 })
  preorderedCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
