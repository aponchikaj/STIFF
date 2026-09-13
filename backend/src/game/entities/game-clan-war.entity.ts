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
import type { WarSide } from '../rules';
import { GameClan } from './game-clan.entity';
import { GameEnrolment } from './game-enrolment.entity';
import { GameSeason } from './game-season.entity';

export const WAR_STATUSES = [
  /** One leader has challenged another. Nothing is staked yet. */
  'proposed',
  /** Both agreed. The book is open and closes when the clock starts. */
  'accepted',
  /** The four hours are running. No more bets. */
  'live',
  /** Time is up; the hand-ins from the window are still being judged. */
  'judging',
  /** Scored, and the book paid out. */
  'settled',
  /** Called off. Every stake went back. */
  'void',
] as const;
export type WarStatus = (typeof WAR_STATUSES)[number];

export const WAR_OUTCOMES = ['challenger', 'opponent', 'draw', 'void'] as const;
export type WarOutcome = (typeof WAR_OUTCOMES)[number];

export const WAR_SETTLEMENT_REASONS = [
  'paid',
  'draw',
  'one_sided',
  'no_bets',
  'void',
] as const;
export type WarSettlementReason = (typeof WAR_SETTLEMENT_REASONS)[number];

/**
 * Two clans, four hours, and whoever's hand-ins earned more Nerve.
 *
 * **The score is read from the score ledger, not counted here.** A war's
 * result is the sum of `task_reward` rows against attempts *submitted*
 * inside the window — submitted, not approved, because a clan should not
 * lose for being reviewed slowly. That is also why a war goes to `judging`
 * rather than straight to `settled`: it waits until nothing from the window
 * is still in the queue, or until the deadline runs out.
 *
 * **`rakePercent` is snapshotted at accept.** The house's cut is
 * configuration, and configuration changes. Reading it at settlement would
 * let a change made during a war move the payout of a bet already placed.
 */
@Entity('game_clan_wars')
@Index(['seasonId', 'status'])
@Index(['status', 'startsAt'])
export class GameClanWar {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => GameSeason, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seasonId' })
  season: GameSeason;

  @Index()
  @Column('uuid')
  seasonId: string;

  @ManyToOne(() => GameClan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'challengerClanId' })
  challengerClan: GameClan;

  @Index()
  @Column('uuid')
  challengerClanId: string;

  @ManyToOne(() => GameClan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'opponentClanId' })
  opponentClan: GameClan;

  @Index()
  @Column('uuid')
  opponentClanId: string;

  /** The enrolment that issued the challenge — a clan leader. */
  @ManyToOne(() => GameEnrolment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'proposedById' })
  proposedBy: GameEnrolment;

  @Column('uuid')
  proposedById: string;

  @Column({ type: 'varchar', length: 16, default: 'proposed' })
  status: WarStatus;

  /** When the four hours begin. Also the moment the book closes. */
  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'timestamptz' })
  endsAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  settledAt: Date | null;

  /** Nerve earned by each side from hand-ins submitted inside the window. */
  @Column({ type: 'int', default: 0 })
  challengerScore: number;

  @Column({ type: 'int', default: 0 })
  opponentScore: number;

  @Column({ type: 'uuid', nullable: true })
  winnerClanId: string | null;

  @Column({ type: 'varchar', length: 12, nullable: true })
  outcome: WarOutcome | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  settlementReason: WarSettlementReason | null;

  /** Frozen when the war was accepted, so a config change cannot move it. */
  @Column({ type: 'smallint', default: 0 })
  rakePercent: number;

  /** What the house actually took. Zero on any refund. */
  @Column({ type: 'int', default: 0 })
  rakeCoins: number;

  /** Said plainly, because the people refunded will want to know. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  voidReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/**
 * One person's stake on one war.
 *
 * One bet per person per war (`UQ_game_war_bets_war_enrolment`): a top-up
 * raises the stake on the row that is already there. Two rows on opposite
 * sides would be a person betting against themselves, which is only ever a
 * way to launder coins between accounts.
 *
 * The coins leave the balance when the bet is placed — `EconomyService.charge`
 * refuses a stake the balance cannot cover — so this row *is* the escrow.
 * `payoutCoins` is what came back, and it stays zero on a loss.
 */
@Entity('game_war_bets')
@Unique('UQ_game_war_bets_war_enrolment', ['warId', 'enrolmentId'])
@Index(['warId', 'side'])
export class GameWarBet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => GameClanWar, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'warId' })
  war: GameClanWar;

  @Index()
  @Column('uuid')
  warId: string;

  @ManyToOne(() => GameEnrolment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'enrolmentId' })
  enrolment: GameEnrolment;

  @Index()
  @Column('uuid')
  enrolmentId: string;

  @Column({ type: 'varchar', length: 11 })
  side: WarSide;

  @Column({ type: 'int' })
  stakeCoins: number;

  @Column({ type: 'int', default: 0 })
  payoutCoins: number;

  @Column({ type: 'boolean', default: false })
  settled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
