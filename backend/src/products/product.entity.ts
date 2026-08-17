import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  /** Total units. Kept in sync with stockBySize when the product has sizes. */
  @Column({ type: 'int', default: 0 })
  stock: number;

  /** Units remaining per size label. Empty object means one-size (use `stock`). */
  @Column({ type: 'jsonb', default: {} })
  stockBySize: Record<string, number>;

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
