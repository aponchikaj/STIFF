import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { GameAttempt } from './game-attempt.entity';
import { GameEnrolment } from './game-enrolment.entity';

export const VOTE_VALUES = ['yes', 'no'] as const;
/** `yes` — the task was really done. `no` — it was not. */
export type VoteValue = (typeof VOTE_VALUES)[number];

/**
 * A watcher's call on a hand-in: done, or not.
 *
 * One per watcher per attempt (`UQ_game_attempt_votes_attempt_enrolment`),
 * changeable while the window is open. `paidCoins` is written when the
 * vote is resolved: what this vote earned, which is zero for a wrong call,
 * a right "no", or a right "yes" inside the voter's cooldown.
 */
@Entity('game_attempt_votes')
@Unique('UQ_game_attempt_votes_attempt_enrolment', ['attemptId', 'enrolmentId'])
@Index(['attemptId', 'vote'])
export class GameAttemptVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => GameAttempt, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attemptId' })
  attempt: GameAttempt;

  @Index()
  @Column('uuid')
  attemptId: string;

  @ManyToOne(() => GameEnrolment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'enrolmentId' })
  enrolment: GameEnrolment;

  @Index()
  @Column('uuid')
  enrolmentId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 4 })
  vote: VoteValue;

  @Column({ type: 'int', default: 0 })
  paidCoins: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
