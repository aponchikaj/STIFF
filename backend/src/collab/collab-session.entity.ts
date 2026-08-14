import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CollabCampaign } from './collab-campaign.entity';
import { CollabCode } from './collab-code.entity';

@Entity('collab_sessions')
export class CollabSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CollabCode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'codeId' })
  code: CollabCode;

  @Column({ type: 'uuid', unique: true })
  codeId: string;

  @ManyToOne(() => CollabCampaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaignId' })
  campaign: CollabCampaign;

  @Column('uuid')
  campaignId: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  sessionHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz' })
  lastSeenAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
