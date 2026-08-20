import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GalleryShoot } from './gallery-shoot.entity';

/**
 * The roles a shoot is credited in.
 *
 * A closed list rather than free text: "Photographer", "photographer" and
 * "Photo" are the same job, and once they are three strings nothing can group
 * by them or build a page per person later.
 */
export const CREDIT_ROLES = [
  'photographer',
  'model',
  'stylist',
  'makeup',
  'hair',
  'art_direction',
  'set_design',
  'retouch',
  'assistant',
  'location',
] as const;

export type CreditRole = (typeof CREDIT_ROLES)[number];

/**
 * One person's credit, on a shoot or on a single frame.
 *
 * Exactly one owner, enforced by `CHK_gallery_credits_one_owner`. The shoot is
 * the usual case — one photographer for the day — and the per-item owner is
 * for the model who appears in only one frame.
 */
@Entity('gallery_credits')
export class GalleryCredit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  shootId: string | null;

  @ManyToOne(() => GalleryShoot, (shoot) => shoot.credits, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'shootId' })
  shoot: GalleryShoot | null;

  @Column({ type: 'uuid', nullable: true })
  galleryItemId: string | null;

  @Column({ type: 'varchar', length: 40 })
  role: CreditRole;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  /**
   * Stored without the leading @, so the display text and the profile URL are
   * both derived from one value rather than one being re-parsed out of the
   * other.
   */
  @Column({ type: 'varchar', length: 60, nullable: true })
  instagram: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  url: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;
}
