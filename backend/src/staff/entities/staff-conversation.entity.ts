import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type StaffConversationType = 'main' | 'dm';

@Entity('staff_conversations')
export class StaffConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ['main', 'dm'] })
  type: StaffConversationType;

  /** `main` for the hall; sorted `idA:idB` for a 1:1 DM. */
  @Column({ type: 'varchar', unique: true, nullable: true })
  dmKey: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
