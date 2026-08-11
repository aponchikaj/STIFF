import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('gallery_items')
export class GalleryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Stable, public URL slug for the route: `/gallery/{slug}`.
  //
  // This must be unique, but `title` is allowed to change without breaking
  // shared links.
  @Column({ type: 'varchar', length: 120, unique: true })
  slug: string;

  // Human-readable label shown in the UI. This is intentionally *not* unique:
  // slugs are unique and stable.
  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Describes the photograph for screen readers and for the alt attribute.
  // Null means "no description written yet" — the UI falls back to the title,
  // which is only ever a catalogue number.
  @Column({ type: 'varchar', length: 300, nullable: true })
  altText: string | null;

  @Column()
  imageUrl: string;

  // Intrinsic pixel size of the upload. The frontend reserves the exact box
  // before the image loads, so the masonry grid never reflows.
  @Column({ type: 'int', nullable: true })
  width: number | null;

  @Column({ type: 'int', nullable: true })
  height: number | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ default: false })
  isArchived: boolean;

  @Column({ type: 'int', default: 0 })
  likeCount: number;

  @Column({ type: 'int', default: 0 })
  dislikeCount: number;

  @Column({ type: 'int', default: 0 })
  commentCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
