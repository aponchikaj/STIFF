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

/**
 * A delivery address someone has saved.
 *
 * "Exactly one default" is a partial unique index in the migration, not a rule
 * this class can express — and not one the service should be trusted with,
 * because two defaults makes checkout pick arbitrarily.
 */
@Entity('user_addresses')
export class UserAddress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column('uuid')
  userId: string;

  /** "Home", "Studio" — how the customer tells them apart. */
  @Column({ type: 'varchar', length: 40, default: '' })
  label: string;

  @Column({ type: 'varchar', length: 60 })
  firstName: string;

  @Column({ type: 'varchar', length: 60 })
  lastName: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  line1: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  line2: string | null;

  @Column({ type: 'varchar', length: 80, default: '' })
  city: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  region: string | null;

  /** Optional: Georgian postcodes exist but are widely unused. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  postalCode: string | null;

  @Column({ type: 'varchar', length: 80, default: 'Georgia' })
  country: string;

  /** Stored normalised to +995XXXXXXXXX so a courier can dial it. */
  @Column({ type: 'varchar', length: 30 })
  phone: string;

  @Column({ default: false })
  isDefault: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
