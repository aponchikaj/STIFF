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
import { User } from '../../users/user.entity';
import { GameAttempt } from './game-attempt.entity';

/**
 * A comment on a feed item.
 *
 * Flat, with no replies. A reel comment thread is read in a scroll, and the
 * shop's nested version exists because a product question has an answer —
 * this does not.
 *
 * `authorHandle` is snapshotted the way `game_enrolments.handle` is, so the
 * thread still reads correctly after someone renames their account.
 */
@Entity('game_attempt_comments')
@Index(['attemptId', 'createdAt'])
export class GameAttemptComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => GameAttempt, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attemptId' })
  attempt: GameAttempt;

  @Index()
  @Column('uuid')
  attemptId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 24 })
  authorHandle: string;

  @Column({ type: 'varchar', length: 500 })
  body: string;

  /** Hidden by enough reports, pending a person. See `GameAttempt.hiddenAt`. */
  @Column({ type: 'timestamptz', nullable: true })
  hiddenAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
