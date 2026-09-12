import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { returnedRows } from '../common/utils/returned-rows';
import { User } from '../users/user.entity';
import { assertOldEnough, parseBirthDate } from './age-gate';
import {
  ENROLMENT_ROLES,
  GameEnrolment,
  type DemotionReason,
  type EnrolmentRole,
  type EnrolmentStatus,
} from './entities/game-enrolment.entity';
import { GameSeason } from './entities/game-season.entity';
import { SeasonsService } from './seasons.service';

/**
 * Why a side was chosen but not yet joined.
 *
 * `null` means it is a real enrolment. The other two are ordinary states of the
 * front door, not errors — the sign-up asks for a side before it asks for an
 * account, so the answer arrives at a moment when there may be nothing to join.
 */
export type PendingReason = 'no_season';

export interface RoleChoice {
  /** The enrolment when a season took them; null when it was only kept. */
  enrolment: EnrolmentView | null;
  /** What they chose, either way. */
  role: EnrolmentRole;
  pending: PendingReason | null;
}

export interface EnrolmentView {
  id: string;
  seasonId: string;
  seasonTitle: string;
  role: EnrolmentRole;
  /** `active`, or why they are a watcher now. */
  status: EnrolmentStatus;
  demotionReason: DemotionReason | null;
  demotedAt: string | null;
  handle: string;
  heartsRemaining: number;
  heartsTotal: number;
  nerve: number;
  coins: number;
}

/** What each demotion reads as to the person it happened to. */
const DEMOTION_MESSAGES: Record<DemotionReason, string> = {
  cheating:
    'Your account was flagged for cheating. You can watch, but you cannot play.',
  missed_daily_minimum:
    'You were moved to watcher for handing in fewer than the daily minimum of tasks.',
  zero_balance:
    'You were moved to watcher after reaching zero Nerve, zero coins and no hearts.',
  out_of_hearts:
    'You lost your last heart, so you are a watcher for the rest of the season.',
};

@Injectable()
export class EnrolmentsService {
  constructor(
    @InjectRepository(GameEnrolment)
    private readonly enrolmentRepo: Repository<GameEnrolment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly seasonsService: SeasonsService,
  ) {}

  /**
   * Takes a side, whether or not there is a season to take it in.
   *
   * `enrol` needs a season that is open. The front door does not have one to
   * offer: it asks which side you are on *before* it asks for an account, so
   * the answer can arrive between seasons, and refusing it would make the only
   * interesting question on the page a dead end.
   *
   * So the choice is either joined or kept. The line between them is the line
   * this game actually draws:
   *
   * - **An enrolment is irreversible by the player.** Once a season has taken
   *   someone as a player, that is fixed — swapping after a bad day would let
   *   them vote on the field they just left. The game itself can still move a
   *   player to watcher; see `DisciplineService`.
   * - **An intention is not.** Someone who picked watcher in October has joined
   *   nothing. Holding them to it in January would enforce a rule about a
   *   season that did not exist when they chose.
   *
   * **The age gate runs first, for both sides.** The game is 16+ strictly —
   * watching included. A date of birth already on the account is what counts;
   * one supplied now is recorded only when the account has none, so a refused
   * sixteen-tomorrow cannot come back with a different year.
   */
  async chooseRole(
    user: User,
    role: EnrolmentRole,
    birthDate?: string,
  ): Promise<RoleChoice> {
    if (!ENROLMENT_ROLES.includes(role)) {
      throw new BadRequestException('Choose player or watcher.');
    }
    await this.gate(user, birthDate);

    const season = await this.seasonsService.current();

    // Between seasons. Nothing exists to join, so the choice is only kept.
    if (!season) {
      await this.remember(user, role);
      return { enrolment: null, role, pending: 'no_season' };
    }

    // Any day of the season, open or running. `enrol` is the atomic path and
    // already settles idempotency and the role clash; nothing here needs to
    // second-guess it.
    const enrolment = await this.enrol(user, role);
    await this.forget(user);
    return { enrolment, role, pending: null };
  }

  /** The side kept from a choice made before there was a season to join. */
  rememberedRole(user: User): EnrolmentRole | null {
    const kept = (user?.settings as { game?: { role?: unknown } } | undefined)
      ?.game?.role;
    return typeof kept === 'string' &&
      (ENROLMENT_ROLES as readonly string[]).includes(kept)
      ? (kept as EnrolmentRole)
      : null;
  }

  /**
   * The 16+ gate.
   *
   * Uses the date on the account when there is one. Otherwise the caller must
   * have sent one, and it is written to the account *before* it is judged, so
   * the answer is on record either way.
   */
  private async gate(user: User, supplied?: string): Promise<void> {
    let birthDate = user.birthDate ?? null;
    if (!birthDate) {
      if (supplied === undefined || supplied === null || supplied === '') {
        throw new BadRequestException(
          'Tell us your date of birth. The game is for people aged 16 and over.',
        );
      }
      birthDate = parseBirthDate(supplied);
      await this.userRepo.update({ id: user.id }, { birthDate });
      user.birthDate = birthDate;
    }
    assertOldEnough(birthDate);
  }

  /**
   * Writes the kept side onto the account.
   *
   * A jsonb merge rather than read-modify-write: `settings` is a shared column
   * — theme and email preferences live there too — and saving the whole entity
   * would carry back whatever it was read with, quietly undoing a change made
   * in between. `||` replaces only the `game` key.
   */
  private async remember(user: User, role: EnrolmentRole): Promise<void> {
    await this.userRepo.query(
      `UPDATE "users"
          SET "settings" = COALESCE("settings", '{}'::jsonb) || $2::jsonb
        WHERE "id" = $1`,
      [user.id, JSON.stringify({ game: { role } })],
    );
    user.settings = { ...(user.settings ?? {}), game: { role } };
  }

  /** The note is spent once a season has taken them; a stale one would lie. */
  private async forget(user: User): Promise<void> {
    if (!this.rememberedRole(user)) return;
    await this.userRepo.query(
      `UPDATE "users" SET "settings" = "settings" - 'game' WHERE "id" = $1`,
      [user.id],
    );
    const next = { ...(user.settings ?? {}) };
    delete next.game;
    user.settings = next;
  }

  /**
   * Takes a side for this season.
   *
   * The role cannot be changed by the player afterwards, and this is where
   * that is enforced. A player who switched to watcher after a bad day would
   * be voting on the field they just left; a watcher who switched to player
   * mid-season would skip the qualifier everyone else passed. Asking again
   * with the same role is idempotent — a double-tapped button is not an error
   * — but asking for the other one is refused with what they already are.
   */
  async enrol(user: User, role: EnrolmentRole): Promise<EnrolmentView> {
    if (!ENROLMENT_ROLES.includes(role)) {
      throw new BadRequestException('Choose player or watcher.');
    }
    const season = await this.seasonsService.requireCurrent();

    // Joining is one statement, because "asking again is idempotent" has to
    // survive the thing that actually causes it: a double tap. Read-then-write
    // would have both requests find nothing, both insert, and the second hit
    // `UQ_game_enrolments_season_user` as an unhandled driver error — a 500
    // for the exact gesture this is meant to tolerate.
    //
    // **Every day, not just day one.** The season no longer shuts its doors
    // once the clock starts: someone who hears about the game on day two joins
    // on day two. They start where everyone starts — zero Nerve, a full set of
    // hearts — and climb from there. `current()` only ever returns an `open`
    // or `running` season, so reaching here at all means there is a season to
    // join.
    //
    // The `WHERE` carries the rule that a side cannot be swapped:
    //
    //   no row yet          -> inserted with the side they asked for
    //   row, same side      -> touched and returned, so asking twice is free
    //   row, the other side -> nothing updated, nothing returned, and the read
    //                          below turns that silence into the real message
    const claimed = returnedRows(
      await this.enrolmentRepo.query(
        `INSERT INTO "game_enrolments"
           ("seasonId", "userId", "role", "handle",
            "heartsRemaining", "heartsTotal", "nerve")
         VALUES ($1, $2, $3, $4, $5, $5, 0)
         ON CONFLICT ("seasonId", "userId") DO UPDATE
           SET "updatedAt" = now()
           WHERE "game_enrolments"."role" = EXCLUDED."role"
         RETURNING *`,
        [
          season.id,
          user.id,
          role,
          user.username,
          // A watcher holds no hearts — they are the player's stake, and
          // giving watchers three would put a number on the profile that
          // means nothing.
          role === 'player' ? season.startingHearts : 0,
        ],
      ),
    ) as GameEnrolment[];

    if (claimed.length > 0) return this.view(claimed[0], season);

    // The upsert declined, which now means one thing only: this account is
    // already on the other side. What is on record answers it.
    const existing = await this.enrolmentRepo.findOne({
      where: { seasonId: season.id, userId: user.id },
    });
    if (!existing) {
      throw new ConflictException('Could not join this season. Try again.');
    }
    if (existing.role !== role) {
      throw new ConflictException(this.roleClash(existing));
    }
    return this.view(existing, season);
  }

  /** This account's enrolment for the live season, or null if not enrolled. */
  async mine(user: User): Promise<EnrolmentView | null> {
    const season = await this.seasonsService.current();
    if (!season) return null;
    const enrolment = await this.enrolmentRepo.findOne({
      where: { seasonId: season.id, userId: user.id },
    });
    return enrolment ? this.view(enrolment, season) : null;
  }

  /**
   * The enrolment behind a request, or an explanation.
   *
   * Every game route that is not simply "read the feed" needs this, and the
   * failure modes read differently to the person: not enrolled at all,
   * enrolled as the other side, or *moved* to the other side — a demoted
   * player is told why, not merely that they are a watcher.
   */
  async require(user: User, role?: EnrolmentRole): Promise<GameEnrolment> {
    const season = await this.seasonsService.requireCurrent();
    const enrolment = await this.enrolmentRepo.findOne({
      where: { seasonId: season.id, userId: user.id },
    });
    if (!enrolment) {
      throw new NotFoundException('You have not joined this season.');
    }
    if (role && enrolment.role !== role) {
      if (role === 'player' && enrolment.demotionReason) {
        throw new ForbiddenException(
          DEMOTION_MESSAGES[enrolment.demotionReason],
        );
      }
      throw new ConflictException(
        role === 'player'
          ? 'You joined this season as a watcher, so you cannot take part.'
          : 'That is for watchers.',
      );
    }
    return enrolment;
  }

  /** The message for asking to be the side you are not. */
  private roleClash(existing: GameEnrolment): string {
    if (existing.demotionReason) {
      return `${DEMOTION_MESSAGES[existing.demotionReason]} That cannot be undone.`;
    }
    return `You are already a ${existing.role} this season, and that cannot be changed.`;
  }

  private view(enrolment: GameEnrolment, season: GameSeason): EnrolmentView {
    return {
      id: enrolment.id,
      seasonId: season.id,
      seasonTitle: season.title,
      role: enrolment.role,
      status: enrolment.status ?? 'active',
      demotionReason: enrolment.demotionReason ?? null,
      demotedAt: enrolment.demotedAt
        ? new Date(enrolment.demotedAt).toISOString()
        : null,
      handle: enrolment.handle,
      heartsRemaining: enrolment.heartsRemaining,
      heartsTotal: enrolment.heartsTotal,
      nerve: enrolment.nerve,
      coins: enrolment.coins ?? 0,
    };
  }
}
