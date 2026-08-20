import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * One row per editable block. The shape of `value` is described by
 * `content.registry.ts`, which is also what validates writes and supplies the
 * fallback copy for blocks that have never been saved.
 */
@Entity('site_content')
export class SiteContent {
  @PrimaryColumn('varchar')
  key: string;

  @Column('jsonb')
  value: Record<string, unknown>;

  @UpdateDateColumn()
  updatedAt: Date;
}
