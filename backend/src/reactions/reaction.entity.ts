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
import { User } from '../users/user.entity';
import type { TargetType } from '../common/types/target-type';

export type ReactionType = 'like' | 'dislike';

@Entity('reactions')
@Unique(['userId', 'targetType', 'targetId'])
@Index(['targetType', 'targetId'])
export class Reaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  userId: string;

  @Column({ type: 'enum', enum: ['product', 'gallery'] })
  targetType: TargetType;

  @Column('uuid')
  targetId: string;

  @Column({ type: 'enum', enum: ['like', 'dislike'] })
  type: ReactionType;

  @CreateDateColumn()
  createdAt: Date;
}
