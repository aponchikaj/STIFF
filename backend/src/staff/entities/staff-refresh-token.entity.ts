import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { StaffUser } from './staff-user.entity';

@Entity('staff_refresh_tokens')
export class StaffRefreshToken {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => StaffUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: StaffUser;

  @Index()
  @Column('uuid')
  userId: string;

  @Column()
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  replacedById: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
