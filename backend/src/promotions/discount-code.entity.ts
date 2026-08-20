import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { DiscountKind } from './pricing';

/**
 * A rule many people can use — distinct from a gift card, which is a balance
 * one holder spends down.
 *
 * Uniqueness is on `upper(code)` via an expression index in
 * `Promotions1787177000000`, so STIFF10 and stiff10 cannot both exist. That has
 * no TypeORM decorator equivalent, hence its absence here.
 */
@Entity('discount_codes')
export class DiscountCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 16 })
  kind: DiscountKind;

  /** percent: 1–100. fixed: minor units off. free_shipping: unused. */
  @Column({ type: 'int', default: 0 })
  value: number;

  @Column({ type: 'int', default: 0 })
  minSubtotalCents: number;

  /** Null means unlimited. */
  @Column({ type: 'int', nullable: true })
  usageLimit: number | null;

  @Column({ type: 'int', nullable: true })
  perUserLimit: number | null;

  @Column({ type: 'int', default: 0 })
  usedCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ default: true })
  isActive: boolean;

  /** What it is for, so a code nobody remembers can still be judged. */
  @Column({ type: 'varchar', length: 200, default: '' })
  note: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
