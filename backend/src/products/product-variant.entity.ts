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
 * One buyable colour-and-size of a product, and the only stock of record.
 *
 * A product with no sizes still has exactly one variant, with `size = ''`, and
 * a product sold in one colour carries `color = ''` — so every read path deals
 * in variants rather than branching on whether this particular product happens
 * to have sizes or colourways.
 *
 * `UQ_product_variants_product_colour_size` and the `stock >= 0` CHECK live in
 * the migrations — the partial unique index on `sku` has no TypeORM decorator
 * equivalent, so they are kept together there rather than split across two
 * places.
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

  /**
   * Colourway label, empty for a product sold in one colour.
   *
   * Part of the variant rather than a product of its own: two products would
   * split one garment's reactions, comments and archive links in half.
   */
  @Column({ type: 'varchar', length: 40, default: '' })
  color: string;

  /**
   * Swatch fill, `#rrggbb`. Null renders the label instead of a chip, which is
   * the right answer for a print or a pattern that no single colour describes.
   *
   * `CHK_product_variants_color_hex` keeps the format honest.
   */
  @Column({ type: 'varchar', length: 7, nullable: true })
  colorHex: string | null;

  /**
   * Photographs of this colourway.
   *
   * Empty falls back to the product's own images, so only a genuine second
   * colourway needs its own shoot.
   */
  @Column({ type: 'text', array: true, default: '{}' })
  images: string[];

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
