import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { StaffPermission } from '../staff.constants';

@Entity('staff_roles')
export class StaffRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  slug: string;

  /** Full access. Only the built-in owner role has this. */
  @Column({ default: false })
  isOwner: boolean;

  @Column({ default: false })
  isSystem: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  permissions: StaffPermission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
