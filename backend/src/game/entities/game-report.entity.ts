import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import type {
  ReportAction,
  ReportPriority,
  ReportStatus,
  ReportTargetType,
} from '../reports/report-rules';
import { GameSeason } from './game-season.entity';

/**
 * What the reported thing looked like when it was reported.
 *
 * A comment gets deleted, a hand-in gets unpublished, a handle gets
 * renamed — and the report has to still make sense to whoever reads it
 * next week. So the row keeps its own copy of the evidence rather than
 * joining to a thing that may be gone. The shape depends on `targetType`;
 * the service is the only writer.
 */
export type ReportSnapshot = Record<string, unknown>;

/**
 * One person saying something is wrong.
 *
 * **Any account can file one, about almost anything the game shows.** A
 * hand-in, a comment, a person, a task brief, a shop item, a clan, their own
 * purchase, or the game itself. What each of those can be reported *for* is
 * `reports/report-rules.ts`, which is also what the client renders, so the
 * sheet never offers a reason the server would refuse.
 *
 * **One open report per person per thing.** The partial unique index
 * `UQ_game_reports_open_reporter_target` holds it: a second tap while the
 * first is still on the queue is a 409, and a fresh report after a dismissal
 * is allowed, because new evidence is a real thing.
 *
 * **Never deleted.** A withdrawn or dismissed report stays as history — the
 * reporter's, so a pattern of bad-faith reports is visible, and the
 * target's, so the fifth report on the same clip lands differently from the
 * first. The reporter and the target user are `SET NULL` on account
 * deletion for the same reason.
 *
 * `targetUserId` is denormalised: the player behind a hand-in, the author of
 * a comment, the person, a clan's leader. It is what "how many reports has
 * this account collected" reads, and it survives the target's deletion.
 */
@Entity('game_reports')
@Index(['status', 'priority', 'createdAt'])
@Index(['targetType', 'targetId'])
@Index(['reporterId', 'createdAt'])
export class GameReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The live season when it was filed; null between seasons. */
  @ManyToOne(() => GameSeason, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'seasonId' })
  season: GameSeason | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  seasonId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reporterId' })
  reporter: User | null;

  @Column({ type: 'uuid', nullable: true })
  reporterId: string | null;

  /** Snapshotted like `game_enrolments.handle`; the account may rename. */
  @Column({ type: 'varchar', length: 24 })
  reporterHandle: string;

  @Column({ type: 'varchar', length: 16 })
  targetType: ReportTargetType;

  /** Null only for `app`. `CHK_game_reports_target` holds that. */
  @Column({ type: 'uuid', nullable: true })
  targetId: string | null;

  /** The account the report is ultimately about, when there is one. */
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'targetUserId' })
  targetUser: User | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  targetUserId: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  snapshot: ReportSnapshot;

  @Column({ type: 'varchar', length: 32 })
  reason: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  details: string | null;

  /** Blocklist ids, for a `dangerous` or `illegal` report. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  tags: string[];

  /** Where in the app the reporter was — a path or a screen name. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  context: string | null;

  /** 0–3. Set from the reason when filed; raised on escalation; an admin may override. */
  @Column({ type: 'smallint', default: 1 })
  priority: ReportPriority;

  @Column({ type: 'varchar', length: 16, default: 'open' })
  status: ReportStatus;

  /** The admin who claimed it. */
  @Column({ type: 'uuid', nullable: true })
  assignedTo: string | null;

  // -------------------------------------------------------- the outcome --

  @Column({ type: 'varchar', length: 24, nullable: true })
  action: ReportAction | null;

  /** Internal. Never shown to the reporter. */
  @Column({ type: 'varchar', length: 1000, nullable: true })
  note: string | null;

  /** What the reporter is told, if anything beyond the outcome. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  reporterMessage: string | null;

  @Column({ type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
