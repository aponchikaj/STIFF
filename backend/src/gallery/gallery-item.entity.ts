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

  // Doubles as the public slug (/gallery/0001), so it has to stay unique.
  @Column({ unique: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

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
