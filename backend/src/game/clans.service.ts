import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { returnedRows, rowsAffected } from '../common/utils/returned-rows';
import { User } from '../users/user.entity';
import {
  GameClan,
  GameClanMember,
  type ClanRole,
  type ClanStatus,
} from './entities/game-clan.entity';
import { GameEnrolment } from './entities/game-enrolment.entity';
import { EnrolmentsService } from './enrolments.service';
import { CLAN_SIZE } from './rules';
import { SeasonsService } from './seasons.service';

export interface ClanMemberView {
  enrolmentId: string;
  handle: string;
  role: ClanRole;
  nerve: number;
  coins: number;
  heartsRemaining: number;
}

export interface ClanView {
  id: string;
  name: string;
  status: ClanStatus;
  size: number;
  members: ClanMemberView[];
  /** Only handed to the clan's own members, and only while forming. */
  inviteCode: string | null;
  /** The reader's own role, or null for an outsider. */
  myRole: ClanRole | null;
  createdAt: string;
}

/** A clan with its two seats, as the services need it. */
export interface ClanSeats {
  clan: GameClan;
  leader: GameClanMember;
  member: GameClanMember | null;
  enrolmentIds: string[];
}

/**
 * Clans: two players, one leader.
 *
 * Three rules, all held by constraints rather than counted:
 *
 * - **One clan per person.** `UQ_game_clan_members_enrolment` — an enrolment
 *   appears in the members table once, as leader or as member.
 * - **Two people, no more.** `UQ_game_clan_members_clan_role` — one leader
 *   seat and one member seat per clan.
 * - **Only the leader starts a task.** Checked by `requireLeader`, which is
 *   what `AssignmentsService.drawForClan` asks before drawing.
 *
 * A clan is per season. It forms with a leader, fills when one person joins
 * by invite code, and is then locked: nobody leaves a full clan, because the
 * team's tasks paid and charged both of them and a walk-out would leave the
 * other holding the score alone. Only a forming clan can be left or
 * disbanded.
 */
@Injectable()
export class ClansService {
  constructor(
    @InjectRepository(GameClan)
    private readonly clanRepo: Repository<GameClan>,
    @InjectRepository(GameClanMember)
    private readonly memberRepo: Repository<GameClanMember>,
    private readonly dataSource: DataSource,
    private readonly seasonsService: SeasonsService,
    private readonly enrolmentsService: EnrolmentsService,
  ) {}

  /** Makes a clan with the caller as leader. */
  async create(user: User, rawName: string): Promise<ClanView> {
    const season = await this.seasonsService.requireCurrent();
    const enrolment = await this.enrolmentsService.require(user, 'player');
    const name = normaliseName(rawName);

    if (await this.membershipOf(enrolment.id)) {
      throw new ConflictException('You are already in a clan this season.');
    }

    const inviteCode = mintCode();
    const created = await this.dataSource.transaction(async (manager) => {
      const rows = returnedRows(
        await manager.query(
          `INSERT INTO "game_clans" ("seasonId", "name", "nameKey", "status", "inviteCode")
           VALUES ($1, $2, $3, 'forming', $4)
           ON CONFLICT ("seasonId", "nameKey") DO NOTHING
           RETURNING "id"`,
          [season.id, name, name.toLowerCase(), inviteCode],
        ),
      ) as { id: string }[];
      if (rows.length === 0) {
        throw new ConflictException('A clan already has that name.');
      }
      // The unique on enrolmentId is what refuses a second clan for the
      // same person if two creates race.
      const seated = rowsAffected(
        await manager.query(
          `INSERT INTO "game_clan_members" ("clanId", "enrolmentId", "role")
           VALUES ($1, $2, 'leader')
           ON CONFLICT ("enrolmentId") DO NOTHING
           RETURNING "id"`,
          [rows[0].id, enrolment.id],
        ),
      );
      if (seated === 0) {
        throw new ConflictException('You are already in a clan this season.');
      }
      return rows[0].id;
    });

    return this.view(await this.seats(created), enrolment.id);
  }

  /** Takes the member seat of a forming clan, by its invite code. */
  async join(user: User, rawCode: string): Promise<ClanView> {
    const season = await this.seasonsService.requireCurrent();
    const enrolment = await this.enrolmentsService.require(user, 'player');
    const code = rawCode.trim().toUpperCase();

    if (await this.membershipOf(enrolment.id)) {
      throw new ConflictException('You are already in a clan this season.');
    }

    const clan = await this.clanRepo.findOne({
      where: { inviteCode: code, seasonId: season.id },
    });
    if (!clan) throw new NotFoundException('No clan has that code.');
    if (clan.status !== 'forming') {
      throw new ConflictException(
        clan.status === 'full'
          ? 'That clan is already full.'
          : 'That clan was disbanded.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      // The member seat is unique per clan, so two people joining together
      // cannot both take it; the second insert matches nothing.
      const seated = rowsAffected(
        await manager.query(
          `INSERT INTO "game_clan_members" ("clanId", "enrolmentId", "role")
           VALUES ($1, $2, 'member')
           ON CONFLICT DO NOTHING
           RETURNING "id"`,
          [clan.id, enrolment.id],
        ),
      );
      if (seated === 0) {
        throw new ConflictException(
          'That clan is already full, or you are already in one.',
        );
      }
      await manager.query(
        `UPDATE "game_clans" SET "status" = 'full', "updatedAt" = now()
          WHERE "id" = $1 AND "status" = 'forming'`,
        [clan.id],
      );
    });

    return this.view(await this.seats(clan.id), enrolment.id);
  }

  /** The caller's clan this season, or null. */
  async mine(user: User): Promise<ClanView | null> {
    const enrolment = await this.enrolmentsService.require(user);
    const membership = await this.membershipOf(enrolment.id);
    if (!membership) return null;
    return this.view(await this.seats(membership.clanId), enrolment.id);
  }

  /**
   * Leaves a forming clan. The member's seat is freed; the leader's leaving
   * disbands it. A full clan cannot be left.
   */
  async leave(user: User): Promise<{ left: true; disbanded: boolean }> {
    const enrolment = await this.enrolmentsService.require(user, 'player');
    const membership = await this.membershipOf(enrolment.id);
    if (!membership) throw new NotFoundException('You are not in a clan.');
    const seats = await this.seats(membership.clanId);
    if (seats.clan.status !== 'forming') {
      throw new ConflictException('A full clan cannot be left this season.');
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(GameClanMember, { id: membership.id });
      if (membership.role === 'leader') {
        await manager.update(
          GameClan,
          { id: seats.clan.id },
          { status: 'disbanded' },
        );
      }
    });
    return { left: true, disbanded: membership.role === 'leader' };
  }

  // ---------------------------------------------------- for other services --

  /** The clan the caller leads, full and ready — or why not. */
  async requireLeader(enrolmentId: string): Promise<ClanSeats> {
    const membership = await this.membershipOf(enrolmentId);
    if (!membership) throw new NotFoundException('You are not in a clan.');
    if (membership.role !== 'leader') {
      throw new ForbiddenException('Only the clan leader can start a task.');
    }
    const seats = await this.seats(membership.clanId);
    if (seats.clan.status !== 'full' || !seats.member) {
      throw new ConflictException(
        'Your clan needs a second person before it can take a task.',
      );
    }
    return seats;
  }

  /** Whether this enrolment sits in this clan. */
  async isMember(clanId: string, enrolmentId: string): Promise<boolean> {
    const row = await this.memberRepo.findOne({
      where: { clanId, enrolmentId },
      select: { id: true },
    });
    return row !== null;
  }

  /** Both enrolment ids of a clan. */
  async memberEnrolmentIds(clanId: string): Promise<string[]> {
    const rows = await this.memberRepo.find({
      where: { clanId },
      select: { enrolmentId: true },
    });
    return rows.map((r) => r.enrolmentId);
  }

  async seats(clanId: string): Promise<ClanSeats> {
    const clan = await this.clanRepo.findOne({ where: { id: clanId } });
    if (!clan) throw new NotFoundException('Clan not found');
    const members = await this.memberRepo.find({
      where: { clanId },
      relations: { enrolment: true },
    });
    const leader = members.find((m) => m.role === 'leader');
    if (!leader) throw new NotFoundException('Clan has no leader');
    const member = members.find((m) => m.role === 'member') ?? null;
    return {
      clan,
      leader,
      member,
      enrolmentIds: members.map((m) => m.enrolmentId),
    };
  }

  // ------------------------------------------------------------- helpers --

  private membershipOf(enrolmentId: string): Promise<GameClanMember | null> {
    return this.memberRepo.findOne({ where: { enrolmentId } });
  }

  private view(seats: ClanSeats, readerEnrolmentId: string): ClanView {
    const rows = [seats.leader, seats.member].filter(
      (m): m is GameClanMember => m !== null,
    );
    const mine = rows.find((m) => m.enrolmentId === readerEnrolmentId);
    return {
      id: seats.clan.id,
      name: seats.clan.name,
      status: seats.clan.status,
      size: CLAN_SIZE,
      members: rows.map((m) => memberView(m, m.enrolment)),
      inviteCode:
        mine && seats.clan.status === 'forming' ? seats.clan.inviteCode : null,
      myRole: mine?.role ?? null,
      createdAt: new Date(seats.clan.createdAt).toISOString(),
    };
  }
}

function memberView(
  m: GameClanMember,
  e: GameEnrolment | undefined,
): ClanMemberView {
  return {
    enrolmentId: m.enrolmentId,
    handle: e?.handle ?? '',
    role: m.role,
    nerve: e?.nerve ?? 0,
    coins: e?.coins ?? 0,
    heartsRemaining: e?.heartsRemaining ?? 0,
  };
}

/** 3–24 characters, trimmed, single-spaced. Letters, digits, spaces, _ - . */
export function normaliseName(raw: string): string {
  const name = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (
    name.length < 3 ||
    name.length > 24 ||
    !/^[\p{L}\p{N} _.-]+$/u.test(name)
  ) {
    throw new BadRequestException(
      'A clan name is 3 to 24 letters, numbers, spaces, dots, dashes or underscores.',
    );
  }
  return name;
}

/** Eight characters from an alphabet without look-alikes. */
export function mintCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}
