import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UserRole = 'user' | 'admin';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  /**
   * Nullable since the game's front door: someone who signs up there gives a
   * username, a password and a side, and nothing else. An account with no
   * email gets no verification mail, no password reset and no order emails —
   * it can add one later from settings. The shop's own register still requires
   * it. Unique where present; Postgres lets any number of rows be null.
   */
  @Column({ type: 'varchar', unique: true, nullable: true })
  email: string | null;

  @Column({ select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: ['user', 'admin'], default: 'user' })
  role: UserRole;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: false })
  isBlocked: boolean;

  /**
   * `YYYY-MM-DD`. Collected by the game, which is 16+ strictly, and checked
   * again at enrolment. Null for an account that has never tried to play.
   */
  @Column({ type: 'date', nullable: true })
  birthDate: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  settings: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export interface SafeUser {
  id: string;
  username: string;
  email: string | null;
  role: UserRole;
  isVerified: boolean;
  birthDate: string | null;
  createdAt: Date;
}

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email ?? null,
    role: user.role,
    isVerified: user.isVerified,
    birthDate: user.birthDate ?? null,
    createdAt: user.createdAt,
  };
}
