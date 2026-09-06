import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

    const existing = await this.enrolmentRepo.findOne({
      where: { seasonId: season.id, userId: user.id },
    });
    if (existing) {
      if (existing.role !== role) {
        throw new ConflictException(
          `You are already a ${existing.role} this season, and that cannot be changed.`,
        );
      }
      return this.view(existing, season);
    }

    if (season.status !== 'open') {
      throw new ConflictException(
        'This season has already started. Enrolment is closed.',
      );
    }

    const enrolment = await this.enrolmentRepo.save(
      this.enrolmentRepo.create({
        seasonId: season.id,
        userId: user.id,
        role,
        handle: user.username,
        // A watcher holds no hearts — they are the player's stake, and giving
        // watchers three would put a number on the profile that means nothing.
        heartsRemaining: role === 'player' ? season.startingHearts : 0,
        heartsTotal: role === 'player' ? season.startingHearts : 0,
        nerve: 0,
      }),
    );
    return this.view(enrolment, season);
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
