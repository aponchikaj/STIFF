import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { SeasonDay } from '../media-rules';
import { GameEnrolment } from './game-enrolment.entity';
import { GameSeason } from './game-season.entity';
import { GameTaskTemplate } from './game-task-template.entity';

export const ASSIGNMENT_STATUSES = [
  'offered',
  'accepted',
  'declined',
  'submitted',
  'expired',
] as const;
/**
 * `offered` — drawn for the player, nothing at stake yet.
 * `accepted` — the clock is running; `expiresAt` is when it hits 00:00.
 * `submitted` — a hand-in was confirmed before the clock ran out.
 * `declined` — the player said no, before or after accepting. Costs a heart.
 * `expired` — the clock ran out with nothing handed in. Costs a heart.
 */
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

/**
 * One task, offered to one player, once.
 *
 * This is where the hearts rule actually lives. A player has three; every
 * decline burns one, every clock that reaches zero burns one, and the player
 * whose last heart goes is a watcher from that moment. None of that can be
 * enforced against a task list the player merely reads, so the server draws
 * the task, the server starts the clock, and the server decides whether the
 * hand-in arrived in time.
 *
 * `UQ_game_task_assignments_enrolment_template` is the "once": a task a
 * player has declined does not come round again for them this season, and a
 * task they finished cannot be farmed.
 *
 * `clockMinutes` is snapshotted from the template so an edit to the pool
 * cannot lengthen or shorten a clock already running.
 */
@Entity('game_task_assignments')
@Unique('UQ_game_task_assignments_enrolment_template', [
  'enrolmentId',
  'taskTemplateId',
])
@Index(['enrolmentId', 'status'])
@Index(['status', 'expiresAt'])
export class GameTaskAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => GameSeason, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seasonId' })
  season: GameSeason;

  @Index()
  @Column('uuid')
  seasonId: string;

  @ManyToOne(() => GameEnrolment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'enrolmentId' })
  enrolment: GameEnrolment;

  @Index()
  @Column('uuid')
  enrolmentId: string;

  /** RESTRICT, not CASCADE: a task with a clock on it is retired, never deleted. */
  @ManyToOne(() => GameTaskTemplate, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'taskTemplateId' })
  taskTemplate: GameTaskTemplate;

  @Index()
  @Column('uuid')
  taskTemplateId: string;

  /**
   * Set when the task was drawn for a clan. The row is still held by the
   * leader's enrolment — the leader is the only one who starts a task — but
   * either member may hand in against it, and both are paid or charged.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  clanId: string | null;

  @Column({ type: 'smallint' })
  day: SeasonDay;

  @Column({ type: 'varchar', length: 16, default: 'offered' })
  status: AssignmentStatus;

  /** From the template at the moment of the draw. */
  @Column({ type: 'int' })
  clockMinutes: number;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  /** `acceptedAt + clockMinutes`. Null until accepted. */
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  /** When it left `offered`/`accepted`, whichever way. */
  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  /** The attempt that finished it. Null unless `submitted`. */
  @Column({ type: 'uuid', nullable: true })
  attemptId: string | null;

  /** Whether this assignment cost the player a heart. */
  @Column({ type: 'boolean', default: false })
  heartBurned: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
