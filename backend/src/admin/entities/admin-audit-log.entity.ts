import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

/**
 * Who changed what, from where.
 *
 * Written for every state-changing request made by an admin, whichever origin
 * it came from. Two decisions worth keeping:
 *
 * - `actorId` is ON DELETE SET NULL and the email/username are *snapshots*.
 *   Deleting an account must not quietly erase what it did, and an audit trail
 *   that disappears with its subject is the one you needed.
 * - `changes` is the request body with credentials stripped (see
 *   `redactBody`). "Order 4f2 changed" is not worth writing down; "changed to
 *   shipped" is.
 */
@Entity('admin_audit_logs')
@Index(['createdAt'])
@Index(['actorId', 'createdAt'])
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actorId' })
  actor: User | null;

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  /** Snapshot — survives the account being deleted. */
  @Column({ type: 'varchar', length: 320 })
  actorEmail: string;

  @Column({ type: 'varchar', length: 120 })
  actorUsername: string;

  /** 'admin' when the request came from admin.stiff.ge, 'shop' otherwise. */
  @Column({ type: 'varchar', length: 16 })
  origin: string;

  @Column({ type: 'varchar', length: 10 })
  method: string;

  @Column({ type: 'varchar', length: 512 })
  path: string;

  @Column({ type: 'int' })
  statusCode: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
