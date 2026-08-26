import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

/**
 * Separate table from `refresh_tokens` on purpose: revoking every admin
 * session must not sign the same person out of the shop, and a shop token
 * family compromise must not hand over admin.stiff.ge.
 */
@Entity('admin_refresh_tokens')
export class AdminRefreshToken {
  // Doubles as the JWT `jti` claim.
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

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
