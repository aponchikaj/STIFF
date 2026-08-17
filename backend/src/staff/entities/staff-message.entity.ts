import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StaffConversation } from './staff-conversation.entity';
import { StaffUser } from './staff-user.entity';

@Entity('staff_messages')
@Index(['conversationId', 'createdAt'])
export class StaffMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => StaffConversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: StaffConversation;

  @Column('uuid')
  conversationId: string;

  @ManyToOne(() => StaffUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender: StaffUser;

  @Column('uuid')
  senderId: string;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn()
  createdAt: Date;
}
