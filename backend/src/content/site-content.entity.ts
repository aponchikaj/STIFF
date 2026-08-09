import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export const CONTENT_KEYS = ['about', 'contact-info'] as const;
export type ContentKey = (typeof CONTENT_KEYS)[number];

@Entity('site_content')
export class SiteContent {
  @PrimaryColumn('varchar')
  key: string;

  @Column('jsonb')
  value: Record<string, unknown>;

  @UpdateDateColumn()
  updatedAt: Date;
}
