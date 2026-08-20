import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from '../products/product.entity';
import { GalleryShoot } from './gallery-shoot.entity';
import { GalleryTag } from './gallery-tag.entity';

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

  /**
   * The shoot this frame came out of, or null for the older archive, which
   * predates shoots. Nullable rather than backfilled into a synthetic
   * "Uncategorised" shoot — that would invent a fact about the archive.
   */
  @Column({ type: 'uuid', nullable: true })
  shootId: string | null;

  @ManyToOne(() => GalleryShoot, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'shootId' })
  shoot: GalleryShoot | null;

  /**
   * A ~500-byte base64 JPEG shown while the real photograph decodes.
   *
   * Inline rather than a URL: a grid of twenty-four placeholder *requests*
   * competes for bandwidth with the photographs it is standing in for, which
   * is the problem it exists to solve. Null until the shot is processed.
   */
  @Column({ type: 'text', nullable: true })
  blurDataUrl: string | null;

  // Clockwise degrees applied at delivery (Cloudinary `a_90` / `a_180` /
  // `a_270`). Stored pixels stay untouched — some phone uploads land on their
  // side, so a standing person reads left-to-right until this is set. 90 and
  // 270 swap the displayed width/height.
  @Column({ type: 'int', default: 0 })
  rotation: number;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ default: false })
  isArchived: boolean;

  /**
   * The pieces worn in this shot.
   *
   * Many-to-many because one photograph can show several pieces and one piece
   * appears in several photographs — a column on either side would force a lie
   * in one direction. This is what "Seen in the archive" reads on a product.
   */
  @ManyToMany(() => Product)
  @JoinTable({
    name: 'gallery_item_products',
    joinColumn: { name: 'galleryItemId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'productId', referencedColumnName: 'id' },
  })
  products: Product[];

  /** Season, location, theme — the axes the archive is filtered along. */
  @ManyToMany(() => GalleryTag)
  @JoinTable({
    name: 'gallery_item_tags',
    joinColumn: { name: 'galleryItemId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tagId', referencedColumnName: 'id' },
  })
  tags: GalleryTag[];

  @Column({ type: 'int', default: 0 })
  likeCount: number;

  @Column({ type: 'int', default: 0 })
  dislikeCount: number;

  @Column({ type: 'int', default: 0 })
  commentCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
