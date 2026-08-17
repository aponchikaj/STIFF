import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { StaffConversation } from './staff-conversation.entity';
import { StaffUser } from './staff-user.entity';

@Entity('staff_conversation_members')
@Unique(['conversationId', 'userId'])
export class StaffConversationMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => StaffConversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: StaffConversation;

  @Index()
  @Column('uuid')
  conversationId: string;

  @ManyToOne(() => StaffUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: StaffUser;

  @Index()
  @Column('uuid')
  userId: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastReadAt: Date | null;
}
