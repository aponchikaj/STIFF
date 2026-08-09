import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export type NotificationType =
  'order_status' | 'comment_reply' | 'broadcast' | 'system';

export interface NotificationMeta {
  orderId?: string;
  commentId?: string;
  targetType?: string;
  targetId?: string;
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column('uuid')
  userId: string;

  @Column({
    type: 'enum',
    enum: ['order_status', 'comment_reply', 'broadcast', 'system'],
  })
  type: NotificationType;

  @Column()
  title: string;

  @Column('text')
  body: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'jsonb', nullable: true })
  meta: NotificationMeta | null;

  @CreateDateColumn()
  createdAt: Date;
}
