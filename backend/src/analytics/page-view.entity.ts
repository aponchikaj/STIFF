import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** One row per page view; visitorId is an anonymous client-generated uuid. */
@Entity('page_views')
export class PageView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 200 })
  path: string;

  @Index()
  @Column('uuid')
  visitorId: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Index()
  @CreateDateColumn()
  createdAt: Date;
}
