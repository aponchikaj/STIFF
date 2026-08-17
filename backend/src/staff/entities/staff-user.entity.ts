import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { StaffRole } from '../staff.constants';

/**
 * Internal staff accounts only. Completely separate from shop `users` —
 * a customer account never grants access here, even with the same email.
 */
@Entity('staff_users')
export class StaffUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  instagramUsername: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: ['owner', 'admin', 'member'],
    default: 'member',
  })
  role: StaffRole;

  @Column({ default: false })
  isBlocked: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export interface SafeStaffUser {
  id: string;
  username: string;
  email: string;
  instagramUsername: string;
  role: StaffRole;
  isBlocked: boolean;
  createdAt: Date;
}

export function toSafeStaffUser(user: StaffUser): SafeStaffUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    instagramUsername: user.instagramUsername,
    role: user.role,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt,
  };
}
