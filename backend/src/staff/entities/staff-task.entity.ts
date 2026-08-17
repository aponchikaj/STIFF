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
import type { StaffTaskStatus } from '../staff.constants';
import { StaffUser } from './staff-user.entity';

@Entity('staff_tasks')
@Index(['assigneeId', 'status'])
export class StaffTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({
    type: 'enum',
    enum: ['todo', 'in_progress', 'done'],
    default: 'todo',
  })
  status: StaffTaskStatus;

  @Column({ type: 'double precision', default: 0 })
  position: number;

  @ManyToOne(() => StaffUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assigneeId' })
  assignee: StaffUser;

  @Column('uuid')
  assigneeId: string;

  @ManyToOne(() => StaffUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: StaffUser | null;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
