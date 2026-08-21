import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * One named moment on a page.
 *
 * `page_views` says somebody arrived. This says what they got to — which
 * section they scrolled into, whether the intro played for them. Same
 * anonymous `visitorId` as a view, so the two join on a visit without either
 * of them holding anything personal.
 */
@Entity('page_events')
export class PageEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  path: string;

  /** "section_view", "intro_shown", "intro_skipped". */
  @Index()
  @Column({ type: 'varchar', length: 40 })
  name: string;

  /** Which one: the section's key, or null when the event has no subject. */
  @Column({ type: 'varchar', length: 60, nullable: true })
  label: string | null;

  @Index()
  @Column('uuid')
  visitorId: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Index()
  @CreateDateColumn()
  createdAt: Date;
}
