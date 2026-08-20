import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * How the filter bar groups itself. Season and location are the two axes the
 * archive is actually browsed along; anything else is a theme.
 */
export const TAG_KINDS = ['season', 'location', 'theme'] as const;

export type TagKind = (typeof TAG_KINDS)[number];

@Entity('gallery_tags')
export class GalleryTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 80 })
  label: string;

  @Column({ type: 'varchar', length: 20, default: 'theme' })
  kind: TagKind;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;
}
