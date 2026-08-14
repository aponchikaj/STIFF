import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CollabCampaign } from './collab-campaign.entity';
import type { CollabCodeStatus } from './collab.constants';

@Entity('collab_codes')
@Index(['campaignId', 'serial'], { unique: true })
export class CollabCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CollabCampaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaignId' })
  campaign: CollabCampaign;

  @Column('uuid')
  campaignId: string;

  @Column({ type: 'int' })
  serial: number;

  @Column({ type: 'varchar', length: 64, unique: true })
  tokenHash: string;

  /** AES-GCM blob so unused codes can be reprinted without storing plaintext. */
  @Column({ type: 'text' })
  tokenEnc: string;

  @Column({ type: 'varchar', length: 16, default: 'unused' })
  status: CollabCodeStatus;

  @Column({ type: 'varchar', length: 80, nullable: true })
  label: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  claimedAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  claimIpHash: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
