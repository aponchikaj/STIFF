import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GalleryCredit } from './gallery-credit.entity';

/**
 * A shoot: a day, a place, and the people who made it.
 *
 * The archive is produced in shoots and was being stored one frame at a time,
 * so fifteen photographs from one afternoon arrived as fifteen unrelated
 * catalogue numbers. This is the entity the uploader already thinks in.
 */
@Entity('gallery_shoots')
export class GalleryShoot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Stable public slug: `/gallery/shoot/{slug}`. */
  @Column({ type: 'varchar', length: 120, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  location: string | null;

  /**
   * A date, not a timestamp — a shoot happened on a day, and the hour is
   * neither recorded nor interesting. Read back as `YYYY-MM-DD`.
   */
  @Column({ type: 'date', nullable: true })
  shotOn: string | null;

  /**
   * The frame that stands for the shoot. Null falls back to the first shot in
   * archive order, so a shoot always has a cover without one being chosen.
   */
  @Column({ type: 'uuid', nullable: true })
  coverItemId: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  /** Lets a shoot be assembled before it goes public. */
  @Column({ default: true })
  isPublished: boolean;

  @OneToMany(() => GalleryCredit, (credit) => credit.shoot)
  credits: GalleryCredit[];

  @CreateDateColumn()
  createdAt: Date;
}
