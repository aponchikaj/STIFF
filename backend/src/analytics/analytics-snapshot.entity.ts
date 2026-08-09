import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('analytics_snapshots')
export class AnalyticsSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date', unique: true })
  date: string;

  @Column({ type: 'int', default: 0 })
  revenueCents: number;

  @Column({ type: 'int', default: 0 })
  ordersCount: number;

  @Column({ type: 'int', default: 0 })
  signupsCount: number;

  @Column({ type: 'int', default: 0 })
  newCommentsCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
