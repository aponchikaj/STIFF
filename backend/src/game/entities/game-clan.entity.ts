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
import { GameEnrolment } from './game-enrolment.entity';
import { GameSeason } from './game-season.entity';

export const CLAN_STATUSES = ['forming', 'full', 'disbanded'] as const;
/**
 * `forming` — the leader is waiting for one person to join by code.
 * `full` — two people; team tasks can be drawn. Locked for the season.
 * `disbanded` — the leader gave up while forming. Nothing else can end one.
 */
export type ClanStatus = (typeof CLAN_STATUSES)[number];

/**
 * A clan: exactly two players, one of whom leads.
 *
 * Anyone can create one; nobody can be in two. Membership is
 * `game_clan_members`, where `UQ_game_clan_members_enrolment` is what makes
 * "one clan per person" a fact and `UQ_game_clan_members_clan_role` what
 * makes "one leader, one member" one — so two is the most a clan can hold
 * without the service having to count.
 *
 * Per season, like everything about a player: the enrolments are per season
 * and a clan is two of them.
 */
@Entity('game_clans')
@Unique('UQ_game_clans_season_name', ['seasonId', 'nameKey'])
@Index(['seasonId', 'status'])
export class GameClan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => GameSeason, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seasonId' })
  season: GameSeason;

  @Index()
  @Column('uuid')
  seasonId: string;

  @Column({ type: 'varchar', length: 24 })
  name: string;

  /** Lowercased `name`, for the uniqueness constraint. */
  @Column({ type: 'varchar', length: 24 })
  nameKey: string;

  @Column({ type: 'varchar', length: 16, default: 'forming' })
  status: ClanStatus;

  /** What the second person types to join. Shown only to members. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 12 })
  inviteCode: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export const CLAN_ROLES = ['leader', 'member'] as const;
export type ClanRole = (typeof CLAN_ROLES)[number];

@Entity('game_clan_members')
@Unique('UQ_game_clan_members_enrolment', ['enrolmentId'])
@Unique('UQ_game_clan_members_clan_role', ['clanId', 'role'])
export class GameClanMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => GameClan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clanId' })
  clan: GameClan;

  @Index()
  @Column('uuid')
  clanId: string;

  @ManyToOne(() => GameEnrolment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'enrolmentId' })
  enrolment: GameEnrolment;

  @Column('uuid')
  enrolmentId: string;

  @Column({ type: 'varchar', length: 8 })
  role: ClanRole;

  @CreateDateColumn()
  createdAt: Date;
}
