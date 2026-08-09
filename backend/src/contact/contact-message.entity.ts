import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('contact_messages')
export class ContactMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  email: string;

  @Column({ type: 'varchar', nullable: true })
  subject: string | null;

  @Column('text')
  message: string;

  @Column({ default: false })
  isHandled: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
