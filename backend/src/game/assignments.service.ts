import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaderLockService } from '../common/redis/leader-lock.service';
import { returnedRows } from '../common/utils/returned-rows';
import { User } from '../users/user.entity';
import { ClansService } from './clans.service';
import { DisciplineService, type HeartBurn } from './discipline.service';
import { EconomyService } from './economy.service';
import {
  GameTaskAssignment,
  type AssignmentStatus,
} from './entities/game-task-assignment.entity';
import { GameTaskTemplate } from './entities/game-task-template.entity';
import { EnrolmentsService } from './enrolments.service';
import { isSeasonDay, type SeasonDay } from './media-rules';
import { clampPenalty } from './rules';
import { SeasonsService } from './seasons.service';
import type { PlayableTask } from './task-templates.service';

export interface AssignmentView {
  id: string;
  status: AssignmentStatus;
  /** Set for a clan's task. Held by the leader; both members are paid. */
  clanId: string | null;
  day: SeasonDay;
  task: PlayableTask;
  clockMinutes: number;
  acceptedAt: string | null;
  expiresAt: string | null;
  /** Whole seconds until 00:00; null unless the clock is running. */
  secondsLeft: number | null;
  heartBurned: boolean;
  attemptId: string | null;
}

/** What a decline hands back: the closed assignment and what it cost. */
export interface DeclineOutcome {
  assignment: AssignmentView;
  heartsRemaining: number;
  /** True when that was the last heart. */
  demoted: boolean;
}

/**
 * The loop: draw, accept, hand in — or decline, or run out of time.
 *
 * Three rules, all enforced here and nowhere else:
 *
 * - **A player holds one task at a time.** One offer waiting, or one clock
 *   running. A second draw returns the offer already waiting rather than a
 *   new one, so a double tap is free and a player cannot shop for an easier
 *   task without paying for the first.
 * - **Saying no costs a heart.** Declining an offer, or giving up on a task
 *   already accepted, burns one. The task does not come round again.
 * - **The clock is the server's.** `expiresAt` is set when the task is
 *   accepted, from `clockMinutes` snapshotted at the draw. A hand-in confirmed
 *   after it is late, whatever the phone's clock said; and a clock nobody
 *   hands in against is swept every minute and burns a heart then.
 *
 * Losing the last heart to any of that makes the player a watcher — see
 * `DisciplineService.burnHearts`.
 *
 * A clan's task follows the same loop with the leader holding the row: only
 * the leader draws, accepts and declines; either member hands in; and a
 * failure — decline or clock — costs both members a heart and the task's
 * coin penalty. See `drawForClan` and `fail`.
 */
@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(
    @InjectRepository(GameTaskAssignment)
    private readonly assignmentRepo: Repository<GameTaskAssignment>,
    @InjectRepository(GameTaskTemplate)
    private readonly templateRepo: Repository<GameTaskTemplate>,
    private readonly seasonsService: SeasonsService,
    private readonly enrolmentsService: EnrolmentsService,
    private readonly discipline: DisciplineService,
    private readonly economy: EconomyService,
    private readonly clans: ClansService,
    private readonly leaderLock: LeaderLockService,
  ) {}

  /**
   * Draws a task for the day.
   *
   * Random from the approved pool at that tier, excluding anything this
   * player has already been offered this season. Only while the ladder is
   * running — an open season is still enrolling and has no clock to start.
   */
  async draw(user: User, day: number): Promise<AssignmentView> {
    const season = await this.seasonsService.requireCurrent();
    if (season.status !== 'running') {
      throw new ConflictException('The season has not started yet.');
    }
    const enrolment = await this.enrolmentsService.require(user, 'player');
    if (!isSeasonDay(day)) throw new ConflictException('There are three days.');

    const held = await this.held(enrolment.id);
    if (held) {
      if (held.status === 'accepted') {
        throw new ConflictException(
          'You already have a task on the clock. Hand it in or decline it first.',
        );
      }
      return this.view(held);
    }

    const picked = returnedRows(
      await this.assignmentRepo.query(
        `INSERT INTO "game_task_assignments"
           ("seasonId", "enrolmentId", "taskTemplateId", "day", "status", "clockMinutes")
         SELECT $1, $2, t."id", $3, 'offered', t."clockMinutes"
           FROM "game_task_templates" t
          WHERE t."status" = 'approved'
            AND t."mode" = 'solo'
            AND t."tier" = $3
            AND NOT EXISTS (
              SELECT 1 FROM "game_task_assignments" a
               WHERE a."enrolmentId" = $2 AND a."taskTemplateId" = t."id"
            )
          ORDER BY random()
          LIMIT 1
         RETURNING "id"`,
        [season.id, enrolment.id, day],
      ),
    ) as { id: string }[];

    if (picked.length === 0) {
      throw new ConflictException('There are no tasks left for you today.');
    }
    return this.view(await this.load(picked[0].id));
  }

  /**
   * Draws a team task for a clan. Leader only, full clan only.
   *
   * The row is held by the leader's enrolment — the leader is the one who
   * starts a task — and carries `clanId` so a hand-in, a verdict, a decline
   * or an expiry reaches both members. "Never the same task twice" is per
   * leader, which for a clan that cannot change is per clan.
   */
  async drawForClan(user: User, day: number): Promise<AssignmentView> {
    const season = await this.seasonsService.requireCurrent();
    if (season.status !== 'running') {
      throw new ConflictException('The season has not started yet.');
    }
    const enrolment = await this.enrolmentsService.require(user, 'player');
    if (!isSeasonDay(day)) throw new ConflictException('There are three days.');
    const seats = await this.clans.requireLeader(enrolment.id);

    const held = await this.held(enrolment.id);
    if (held) {
      if (held.status === 'accepted') {
        throw new ConflictException(
          'You already have a task on the clock. Hand it in or decline it first.',
        );
      }
      if (held.clanId === seats.clan.id) return this.view(held);
      throw new ConflictException(
        'You are holding a solo task. Accept or decline it before drawing for your clan.',
      );
    }

    const picked = returnedRows(
      await this.assignmentRepo.query(
        `INSERT INTO "game_task_assignments"
           ("seasonId", "enrolmentId", "clanId", "taskTemplateId", "day", "status", "clockMinutes")
         SELECT $1, $2, $4, t."id", $3, 'offered', t."clockMinutes"
           FROM "game_task_templates" t
          WHERE t."status" = 'approved'
            AND t."mode" = 'team'
            AND t."tier" = $3
            AND NOT EXISTS (
              SELECT 1 FROM "game_task_assignments" a
               WHERE a."enrolmentId" = $2 AND a."taskTemplateId" = t."id"
            )
          ORDER BY random()
          LIMIT 1
         RETURNING "id"`,
        [season.id, enrolment.id, day, seats.clan.id],
      ),
    ) as { id: string }[];

    if (picked.length === 0) {
      throw new ConflictException(
        'There are no team tasks left for your clan today.',
      );
    }
    return this.view(await this.load(picked[0].id));
  }

  /** The offer waiting or the clock running, or null. */
  async current(user: User): Promise<AssignmentView | null> {
    const enrolment = await this.enrolmentsService.require(user, 'player');
    const held = await this.held(enrolment.id);
    return held ? this.view(held) : null;
  }

  /**
   * Starts the clock. One statement, so two taps cannot start two clocks.
   */
  async accept(user: User, assignmentId: string): Promise<AssignmentView> {
    const enrolment = await this.enrolmentsService.require(user, 'player');

    const running = await this.assignmentRepo
      .createQueryBuilder('a')
      .where('a.enrolmentId = :enrolmentId', { enrolmentId: enrolment.id })
      .andWhere('a.status = :status', { status: 'accepted' })
      .andWhere('a.id <> :id', { id: assignmentId })
      .getOne();
    if (running) {
      throw new ConflictException(
        'You already have a task on the clock. Hand it in or decline it first.',
      );
    }

    const claimed = returnedRows(
      await this.assignmentRepo.query(
        `UPDATE "game_task_assignments"
            SET "status"     = 'accepted',
                "acceptedAt" = now(),
                "expiresAt"  = now() + make_interval(mins => "clockMinutes"),
                "updatedAt"  = now()
          WHERE "id" = $1 AND "enrolmentId" = $2 AND "status" = 'offered'
          RETURNING "id"`,
        [assignmentId, enrolment.id],
      ),
    ) as { id: string }[];

    if (claimed.length === 0) {
      const existing = await this.own(assignmentId, enrolment.id);
      if (existing.status === 'accepted') return this.view(existing);
      throw new ConflictException(`That task is already ${existing.status}.`);
    }
    return this.view(await this.load(assignmentId));
  }

  /**
   * Says no. Costs a heart whether the clock had started or not, and the
   * last heart makes the player a watcher on the spot.
   */
  async decline(user: User, assignmentId: string): Promise<DeclineOutcome> {
    const enrolment = await this.enrolmentsService.require(user, 'player');

    const claimed = returnedRows(
      await this.assignmentRepo.query(
        `UPDATE "game_task_assignments"
            SET "status"      = 'declined',
                "resolvedAt"  = now(),
                "heartBurned" = true,
                "updatedAt"   = now()
          WHERE "id" = $1 AND "enrolmentId" = $2
            AND "status" IN ('offered', 'accepted')
          RETURNING "id"`,
        [assignmentId, enrolment.id],
      ),
    ) as { id: string }[];

    if (claimed.length === 0) {
      const existing = await this.own(assignmentId, enrolment.id);
      throw new ConflictException(`That task is already ${existing.status}.`);
    }

    const closed = await this.load(assignmentId);
    const burns = await this.fail(closed, 'declined');
    const mine = burns.find((b) => b.enrolmentId === enrolment.id);
    return {
      assignment: this.view(closed),
      heartsRemaining: mine?.heartsRemaining ?? enrolment.heartsRemaining,
      demoted: mine?.demoted ?? false,
    };
  }

  /**
   * What a decline or an expiry costs.
   *
   * A solo task: one heart, to the holder. A clan task: one heart to each
   * member, and the template's penalty — one to three coins — from each.
   * The heart rule and the coin rule are both the whole clan's, because the
   * task was.
   */
  private async fail(
    assignment: GameTaskAssignment,
    cause: 'declined' | 'expired',
  ): Promise<HeartBurn[]> {
    const ids = assignment.clanId
      ? await this.clans.memberEnrolmentIds(assignment.clanId)
      : [assignment.enrolmentId];
    const burns = await this.discipline.burnHearts(ids, cause);
    if (assignment.clanId) {
      const penalty = clampPenalty(assignment.taskTemplate?.penaltyCoins);
      const moved = await this.economy.move(ids, {
        coins: -penalty,
        reason: 'task_penalty',
        refType: 'assignment',
        refId: assignment.id,
      });
      await this.economy.announce(
        moved,
        'Your clan failed a task',
        (m) =>
          `${cause === 'declined' ? 'The task was declined' : 'The clock ran out'}. ${-m.coinsDelta} coin(s) taken; you have ${m.coinsAfter}.`,
      );
    }
    return burns;
  }

  /**
   * The assignment an upload may open against: this player's, accepted, and
   * with time left. Anything else is refused with what it actually is.
   */
  async requireOpen(
    enrolmentId: string,
    assignmentId: string,
  ): Promise<GameTaskAssignment> {
    const assignment = await this.ownOrClan(assignmentId, enrolmentId);
    if (assignment.status !== 'accepted') {
      throw new ConflictException(
        assignment.status === 'offered'
          ? 'Accept the task before you hand in.'
          : `That task is already ${assignment.status}.`,
      );
    }
    if (assignment.expiresAt && assignment.expiresAt.getTime() <= Date.now()) {
      // Overdue and not yet swept: settle it now rather than let the player
      // find out at the next minute boundary.
      await this.expireOne(assignment.id);
      throw new ConflictException('Time ran out on that task.');
    }
    return assignment;
  }

  /**
   * Closes the assignment with the hand-in — only if the clock has not run
   * out. Returns false when it has; the caller decides what to do with the
   * late file.
   */
  async closeWithAttempt(
    assignmentId: string,
    enrolmentId: string,
    attemptId: string,
  ): Promise<boolean> {
    // A clan task is held by the leader but may be handed in by either
    // member, so the holder check is "the holder, or the clan the holder
    // leads has this enrolment in it".
    const rows = returnedRows(
      await this.assignmentRepo.query(
        `UPDATE "game_task_assignments" a
            SET "status"     = 'submitted',
                "attemptId"  = $3,
                "resolvedAt" = now(),
                "updatedAt"  = now()
          WHERE a."id" = $1
            AND (a."enrolmentId" = $2
                 OR (a."clanId" IS NOT NULL AND EXISTS (
                      SELECT 1 FROM "game_clan_members" m
                       WHERE m."clanId" = a."clanId" AND m."enrolmentId" = $2)))
            AND a."status" = 'accepted'
            AND a."expiresAt" > now()
          RETURNING a."id"`,
        [assignmentId, enrolmentId, attemptId],
      ),
    );
    return rows.length > 0;
  }

  // --------------------------------------------------------------- clock --

  /**
   * Every accepted task whose clock has reached zero: expired, and a heart
   * burned. The cron's body and the late-hand-in path both come through here.
   */
  async expireOverdue(onlyId?: string): Promise<{
    expired: number;
    burns: HeartBurn[];
  }> {
    const rows = returnedRows(
      await this.assignmentRepo.query(
        `UPDATE "game_task_assignments"
            SET "status"      = 'expired',
                "resolvedAt"  = now(),
                "heartBurned" = true,
                "updatedAt"   = now()
          WHERE "status" = 'accepted'
            AND "expiresAt" <= now()
            AND ($1::uuid IS NULL OR "id" = $1::uuid)
          RETURNING "id", "enrolmentId", "clanId"`,
        [onlyId ?? null],
      ),
    ) as { id: string; enrolmentId: string; clanId: string | null }[];

    if (rows.length === 0) return { expired: 0, burns: [] };

    // Solo expiries burn in one statement; a clan's goes through `fail` so
    // both members pay, hearts and coins alike.
    const solo = rows.filter((r) => !r.clanId);
    const burns = await this.discipline.burnHearts(
      solo.map((r) => r.enrolmentId),
      'expired',
    );
    for (const row of rows.filter((r) => r.clanId)) {
      burns.push(...(await this.fail(await this.load(row.id), 'expired')));
    }
    this.logger.log(
      `Clock: ${rows.length} task(s) expired, ${burns.filter((b) => b.demoted).length} player(s) out of hearts`,
    );
    return { expired: rows.length, burns };
  }

  private async expireOne(assignmentId: string): Promise<void> {
    await this.expireOverdue(assignmentId);
  }

  /** Every minute. A clock that hits 00:00 is settled within the minute. */
  @Cron('* * * * *')
  async sweepClocks(): Promise<void> {
    try {
      await this.leaderLock.withLock('gameTaskClock', 55_000, () =>
        this.expireOverdue(),
      );
    } catch (err) {
      this.logger.error(
        'gameTaskClock failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // ------------------------------------------------------------- helpers --

  /** The one assignment a player can be holding: offered, or accepted. */
  private held(enrolmentId: string): Promise<GameTaskAssignment | null> {
    return this.assignmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.taskTemplate', 'task')
      .where('a.enrolmentId = :enrolmentId', { enrolmentId })
      .andWhere('a.status IN (:...statuses)', {
        statuses: ['offered', 'accepted'],
      })
      .orderBy('a.createdAt', 'DESC')
      .getOne();
  }

  private async own(
    assignmentId: string,
    enrolmentId: string,
  ): Promise<GameTaskAssignment> {
    const row = await this.assignmentRepo.findOne({
      where: { id: assignmentId, enrolmentId },
      relations: { taskTemplate: true },
    });
    if (!row) throw new NotFoundException('Task not found');
    return row;
  }

  /** The holder's assignment, or one held by the clan this enrolment is in. */
  private async ownOrClan(
    assignmentId: string,
    enrolmentId: string,
  ): Promise<GameTaskAssignment> {
    const row = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
      relations: { taskTemplate: true },
    });
    if (!row) throw new NotFoundException('Task not found');
    if (row.enrolmentId === enrolmentId) return row;
    if (row.clanId && (await this.clans.isMember(row.clanId, enrolmentId))) {
      return row;
    }
    throw new NotFoundException('Task not found');
  }

  private async load(assignmentId: string): Promise<GameTaskAssignment> {
    const row = await this.assignmentRepo.findOne({
      where: { id: assignmentId },
      relations: { taskTemplate: true },
    });
    if (!row) throw new NotFoundException('Task not found');
    return row;
  }

  private view(a: GameTaskAssignment): AssignmentView {
    const t = a.taskTemplate;
    const expiresAt = a.expiresAt ? new Date(a.expiresAt) : null;
    return {
      id: a.id,
      status: a.status,
      clanId: a.clanId ?? null,
      day: a.day,
      task: {
        id: t?.id ?? a.taskTemplateId,
        slug: t?.slug ?? '',
        tier: t?.tier ?? a.day,
        title: t?.title ?? '',
        brief: t?.brief ?? '',
        proof: t?.proof ?? 'either',
        mode: t?.mode ?? (a.clanId ? 'team' : 'solo'),
        rewardNerve: t?.rewardNerve ?? 0,
        rewardCoins: t?.rewardCoins ?? 0,
        penaltyCoins: clampPenalty(t?.penaltyCoins),
        clockMinutes: a.clockMinutes,
        guards: t?.guards ?? [],
        criteria: t?.criteria ?? [],
      },
      clockMinutes: a.clockMinutes,
      acceptedAt: a.acceptedAt ? new Date(a.acceptedAt).toISOString() : null,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      secondsLeft:
        a.status === 'accepted' && expiresAt
          ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000))
          : null,
      heartBurned: a.heartBurned,
      attemptId: a.attemptId,
    };
  }
}
