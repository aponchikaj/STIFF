import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { CollabVideoProvider } from './collab.constants';

@Entity('collab_campaigns')
export class CollabCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 40, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'int', default: 300 })
  maxCodes: number;

  /**
   * On: one scan, cookie-bound, anti-capture. Off: the same QR can be
   * opened again and screening / sharing are allowed.
   */
  @Column({ default: true })
  strictMode: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  videoProvider: CollabVideoProvider | null;

  /** Cloudinary public_id, or a filename under private-media/. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  videoPublicId: string | null;

  /** `authenticated` or `upload` — how Cloudinary stored the file. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  videoDeliveryType: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  videoMime: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  videoUploadedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
