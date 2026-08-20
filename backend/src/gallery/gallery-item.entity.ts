import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from '../products/product.entity';

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

  @Column({ type: 'int', default: 0 })
  likeCount: number;

  @Column({ type: 'int', default: 0 })
  dislikeCount: number;

  @Column({ type: 'int', default: 0 })
  commentCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
