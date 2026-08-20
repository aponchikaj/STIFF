import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A balance belonging to whoever holds the code.
 *
 * `remainingCents` is guarded by a CHECK (0 <= remaining <= initial) in the
 * migration rather than by the service: this is money, and a balance that
 * drifts outside those bounds should fail at the database, loudly.
 */
@Entity('gift_cards')
export class GiftCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'int' })
  initialCents: number;

  @Column({ type: 'int' })
  remainingCents: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'varchar', length: 200, default: '' })
  note: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
