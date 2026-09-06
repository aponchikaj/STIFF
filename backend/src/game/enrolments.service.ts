import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { returnedRows } from '../common/utils/returned-rows';
import { User } from '../users/user.entity';
import {
  ENROLMENT_ROLES,
  GameEnrolment,
  type EnrolmentRole,
} from './entities/game-enrolment.entity';
import { GameSeason } from './entities/game-season.entity';
import { SeasonsService } from './seasons.service';

export interface EnrolmentView {
  id: string;
  seasonId: string;
  seasonTitle: string;
  role: EnrolmentRole;
  handle: string;
  heartsRemaining: number;
  heartsTotal: number;
  nerve: number;
}

@Injectable()
export class EnrolmentsService {
  constructor(
    @InjectRepository(GameEnrolment)
    private readonly enrolmentRepo: Repository<GameEnrolment>,
    private readonly seasonsService: SeasonsService,
  ) {}

  /**
   * Takes a side for this season.
   *
   * The role cannot be changed afterwards, and this is where that is enforced.
   * A player who switched to watcher after a bad day would be voting on the
   * field they just left; a watcher who switched to player mid-season would
   * skip the qualifier everyone else passed. Asking again with the same role
   * is idempotent — a double-tapped button is not an error — but asking for
   * the other one is refused with what they already are.
   */
  async enrol(user: User, role: EnrolmentRole): Promise<EnrolmentView> {
    if (!ENROLMENT_ROLES.includes(role)) {
      throw new BadRequestException('Choose player or watcher.');
    }
    const season = await this.seasonsService.requireCurrent();

    // Joining is one statement while the season is open, because "asking again
    // is idempotent" has to survive the thing that actually causes it: a
    // double tap. Read-then-write would have both requests find nothing, both
    // insert, and the second hit `UQ_game_enrolments_season_user` as an
    // unhandled driver error — a 500 for the exact gesture this is meant to
    // tolerate.
    //
    // The `WHERE` carries the rule that a side cannot be swapped:
    //
    //   no row yet          -> inserted with the side they asked for
    //   row, same side      -> touched and returned, so asking twice is free
    //   row, the other side -> nothing updated, nothing returned, and the read
    //                          below turns that silence into the real message
    if (season.status === 'open') {
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
    }

    // Either the season is shut, or the upsert declined because this account
    // is already on the other side. Both are answered by what is on record.
    const existing = await this.enrolmentRepo.findOne({
      where: { seasonId: season.id, userId: user.id },
    });
    if (!existing) {
      throw new ConflictException(
        'This season has already started. Enrolment is closed.',
      );
    }
    if (existing.role !== role) {
      throw new ConflictException(
        `You are already a ${existing.role} this season, and that cannot be changed.`,
      );
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
   * two failure modes read differently to the person: not enrolled at all, and
   * enrolled as the other side.
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
      throw new ConflictException(
        role === 'player'
          ? 'You joined this season as a watcher, so you cannot take part.'
          : 'That is for watchers.',
      );
    }
    return enrolment;
  }

  private view(enrolment: GameEnrolment, season: GameSeason): EnrolmentView {
    return {
      id: enrolment.id,
      seasonId: season.id,
      seasonTitle: season.title,
      role: enrolment.role,
      handle: enrolment.handle,
      heartsRemaining: enrolment.heartsRemaining,
      heartsTotal: enrolment.heartsTotal,
      nerve: enrolment.nerve,
    };
  }
}
