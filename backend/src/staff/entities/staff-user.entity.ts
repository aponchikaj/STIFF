import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  STAFF_PERMISSION_KEYS,
  type StaffPermission,
} from '../staff.constants';
import { StaffRole } from './staff-role.entity';

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

  @ManyToOne(() => StaffRole, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'roleId' })
  assignedRole: StaffRole;

  @Column('uuid')
  roleId: string;

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
  role: string;
  roleName: string;
  roleId: string;
  isOwner: boolean;
  permissions: StaffPermission[];
  isBlocked: boolean;
  createdAt: Date;
}

export function toSafeStaffUser(user: StaffUser): SafeStaffUser {
  const assigned = user.assignedRole;
  const isOwner = assigned?.isOwner === true;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    instagramUsername: user.instagramUsername,
    role: assigned?.slug ?? 'member',
    roleName: assigned?.name ?? 'Member',
    roleId: user.roleId,
    isOwner,
    permissions: isOwner
      ? [...STAFF_PERMISSION_KEYS]
      : [...(assigned?.permissions ?? [])],
    isBlocked: user.isBlocked,
    createdAt: user.createdAt,
  };
}
