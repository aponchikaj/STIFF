import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { GameAttempt } from './game-attempt.entity';

/**
 * A like on a feed item. One per person per item, and that is the whole shape.
 *
 * There is no dislike here, unlike the shop's `reactions`. The feed is a
 * competition entry someone filmed of themselves in public; a public downvote
 * on it is a different product with different consequences, and adding the
 * column "just in case" is how it arrives by accident.
 */
@Entity('game_attempt_reactions')
@Unique('UQ_game_attempt_reactions_attempt_user', ['attemptId', 'userId'])
export class GameAttemptReaction {
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

  @CreateDateColumn()
  createdAt: Date;
}
