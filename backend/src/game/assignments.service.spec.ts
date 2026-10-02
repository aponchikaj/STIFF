import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { LeaderLockService } from '../common/redis/leader-lock.service';
import { User } from '../users/user.entity';
import { AssignmentsService } from './assignments.service';
import { ClansService } from './clans.service';
import { DisciplineService } from './discipline.service';
import { EconomyService } from './economy.service';
import { GameTaskAssignment } from './entities/game-task-assignment.entity';
import { GameTaskTemplate } from './entities/game-task-template.entity';
import { EnrolmentsService } from './enrolments.service';
import { SeasonsService } from './seasons.service';

/**
 * The loop: draw, accept, hand in — or decline, or run out of time.
 *
 * These are the rules a player pays hearts for, so they are held here rather
 * than left to whatever the service happened to do: one task at a time, a
 * decline costs a heart, the clock is the server's, and a late hand-in is
 * late whatever the phone said.
 */

const PLAYER = { id: 'u1', username: 'asterisk' } as User;

const TEMPLATE = {
  id: 't1',
  slug: 'wear-it-backwards',
  tier: 1,
  title: 'Wear it backwards',
  brief: 'Put your jacket on backwards and walk one block.',
  proof: 'video',
  mode: 'solo',
  rewardNerve: 10,
  rewardCoins: 2,
  penaltyCoins: 2,
  clockMinutes: 15,
  guards: ['own_wardrobe'],
  criteria: [],
};

/** A team task, held by the leader `e1` for clan `c1` with member `e2`. */
function clanAssignment(overrides: Record<string, unknown> = {}) {
  return assignment({
    id: 'as9',
    clanId: 'c1',
    taskTemplate: { ...TEMPLATE, id: 't9', mode: 'team', penaltyCoins: 2 },
    taskTemplateId: 't9',
    ...overrides,
  });
}

function assignment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'as1',
    enrolmentId: 'e1',
    taskTemplateId: 't1',
    taskTemplate: TEMPLATE,
    clanId: null,
    day: 1,
    status: 'offered',
    clockMinutes: 15,
    acceptedAt: null,
    expiresAt: null,
    resolvedAt: null,
    attemptId: null,
    heartBurned: false,
    ...overrides,
  };
}

/** A minute ahead, or a minute behind. */
function inMinutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

describe('AssignmentsService', () => {
  let service: AssignmentsService;
  let repo: {
    query: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  /** What `held()` and the accept guard read through the builder. */
  let getOne: jest.Mock;
  let seasons: { requireCurrent: jest.Mock };
  let enrolments: { require: jest.Mock };
  let discipline: { burnHearts: jest.Mock };
  let economy: { move: jest.Mock; announce: jest.Mock };
  let clans: {
    requireLeader: jest.Mock;
    isMember: jest.Mock;
    memberEnrolmentIds: jest.Mock;
  };
  let leaderLock: { withLock: jest.Mock };

  beforeEach(async () => {
    getOne = jest.fn().mockResolvedValue(null);
    const builder: Record<string, jest.Mock> = {};
    for (const step of ['where', 'andWhere', 'orderBy', 'leftJoinAndSelect']) {
      builder[step] = jest.fn(() => builder);
    }
    builder.getOne = getOne;

    repo = {
      query: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(() => builder),
    };
    seasons = {
      requireCurrent: jest.fn().mockResolvedValue({
        id: 's1',
        slug: 'season-zero',
        status: 'running',
      }),
    };
    enrolments = {
      require: jest
        .fn()
        .mockResolvedValue({ id: 'e1', role: 'player', heartsRemaining: 3 }),
    };
    discipline = {
      burnHearts: jest.fn().mockResolvedValue([
        {
          enrolmentId: 'e1',
          userId: 'u1',
          heartsRemaining: 2,
          demoted: false,
        },
      ]),
    };
    economy = {
      move: jest.fn().mockResolvedValue([]),
      announce: jest.fn().mockResolvedValue(undefined),
    };
    clans = {
      requireLeader: jest
        .fn()
        .mockResolvedValue({ clan: { id: 'c1', status: 'full' } }),
      isMember: jest.fn().mockResolvedValue(false),
      memberEnrolmentIds: jest.fn().mockResolvedValue(['e1', 'e2']),
    };
    leaderLock = {
      withLock: jest.fn((_name: string, _ttl: number, job: () => unknown) =>
        job(),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        { provide: getRepositoryToken(GameTaskAssignment), useValue: repo },
        { provide: getRepositoryToken(GameTaskTemplate), useValue: {} },
        { provide: SeasonsService, useValue: seasons },
        { provide: EnrolmentsService, useValue: enrolments },
        { provide: DisciplineService, useValue: discipline },
        { provide: EconomyService, useValue: economy },
        { provide: ClansService, useValue: clans },
        { provide: LeaderLockService, useValue: leaderLock },
      ],
    }).compile();

    service = module.get(AssignmentsService);
  });

  describe('draw', () => {
    /** An open season is still enrolling; there is no clock to start. */
    it('refuses while the season is not running', async () => {
      seasons.requireCurrent.mockResolvedValue({ id: 's1', status: 'open' });
      await expect(service.draw(PLAYER, 1)).rejects.toThrow(ConflictException);
      await expect(service.draw(PLAYER, 1)).rejects.toThrow(/not started/);
      expect(repo.query).not.toHaveBeenCalled();
    });

    it('refuses a day off the ladder', async () => {
      await expect(service.draw(PLAYER, 4)).rejects.toThrow(/three days/);
      expect(repo.query).not.toHaveBeenCalled();
    });

    it('asks for a player enrolment, not merely a session', async () => {
      repo.query.mockResolvedValue([{ id: 'as1' }]);
      repo.findOne.mockResolvedValue(assignment());
      await service.draw(PLAYER, 1);
      expect(enrolments.require).toHaveBeenCalledWith(PLAYER, 'player');
    });

    /**
     * One task at a time. A double tap, or a player shopping for an easier
     * task, both get the offer already waiting — never a second one.
     */
    it('returns the offer already waiting rather than drawing again', async () => {
      getOne.mockResolvedValue(assignment());
      const view = await service.draw(PLAYER, 1);
      expect(view.id).toBe('as1');
      expect(view.status).toBe('offered');
      expect(repo.query).not.toHaveBeenCalled();
    });

    it('refuses while a clock is already running', async () => {
      getOne.mockResolvedValue(
        assignment({ status: 'accepted', expiresAt: inMinutes(10) }),
      );
      await expect(service.draw(PLAYER, 1)).rejects.toThrow(
        /already have a task on the clock/,
      );
      expect(repo.query).not.toHaveBeenCalled();
    });

    /**
     * The pick is one statement: random from the approved pool at that tier,
     * excluding anything this player has already been offered this season.
     */
    it('draws at random from the approved pool, once per task per player', async () => {
      repo.query.mockResolvedValue([{ id: 'as1' }]);
      repo.findOne.mockResolvedValue(assignment());
      await service.draw(PLAYER, 2);
      const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/INSERT INTO "game_task_assignments"/);
      expect(sql).toMatch(/ORDER BY random\(\)/);
      expect(sql).toMatch(/NOT EXISTS/);
      expect(sql).toMatch(/'approved'/);
      expect(sql).toMatch(/'offered'/);
      expect(params).toEqual(['s1', 'e1', 2]);
    });

    /** A team task is a clan's to draw; a solo draw never lands on one. */
    it('draws solo tasks only', async () => {
      repo.query.mockResolvedValue([{ id: 'as1' }]);
      repo.findOne.mockResolvedValue(assignment());
      await service.draw(PLAYER, 1);
      const [sql] = repo.query.mock.calls[0] as [string];
      expect(sql).toMatch(/"mode" = 'solo'/);
    });

    it('says so when the pool has nothing left for them', async () => {
      repo.query.mockResolvedValue([]);
      await expect(service.draw(PLAYER, 1)).rejects.toThrow(ConflictException);
      await expect(service.draw(PLAYER, 1)).rejects.toThrow(/no tasks left/);
    });

    it('returns the task with the offer, and no clock yet', async () => {
      repo.query.mockResolvedValue([{ id: 'as1' }]);
      repo.findOne.mockResolvedValue(assignment());
      const view = await service.draw(PLAYER, 1);
      expect(view.task).toMatchObject({
        id: 't1',
        title: 'Wear it backwards',
        clockMinutes: 15,
      });
      expect(view.secondsLeft).toBeNull();
      expect(view.expiresAt).toBeNull();
      expect(view.heartBurned).toBe(false);
    });

    /** The player is told how to prove it before they accept. */
    it('carries the task’s proof from the template', async () => {
      repo.query.mockResolvedValue([{ id: 'as1' }]);
      repo.findOne.mockResolvedValue(assignment());
      const view = await service.draw(PLAYER, 1);
      expect(view.task.proof).toBe('video');
    });

    it('reads a template with no proof as either', async () => {
      repo.query.mockResolvedValue([{ id: 'as1' }]);
      repo.findOne.mockResolvedValue(
        assignment({ taskTemplate: { ...TEMPLATE, proof: undefined } }),
      );
      const view = await service.draw(PLAYER, 1);
      expect(view.task.proof).toBe('either');
    });
  });

  describe('the view', () => {
    it('carries the clan and the task’s economy', async () => {
      getOne.mockResolvedValue(clanAssignment());
      const view = await service.current(PLAYER);
      expect(view?.clanId).toBe('c1');
      expect(view?.task).toMatchObject({
        mode: 'team',
        rewardNerve: 10,
        rewardCoins: 2,
        penaltyCoins: 2,
      });
    });

    it('reads a solo task with no clan', async () => {
      getOne.mockResolvedValue(assignment());
      const view = await service.current(PLAYER);
      expect(view?.clanId).toBeNull();
      expect(view?.task.mode).toBe('solo');
    });

    /** One to three, whatever a template says. */
    it.each([
      [5, 3],
      [0, 1],
      [undefined, 1],
      [2, 2],
    ])('clamps a template penalty of %s to %s', async (raw, clamped) => {
      getOne.mockResolvedValue(
        assignment({ taskTemplate: { ...TEMPLATE, penaltyCoins: raw } }),
      );
      const view = await service.current(PLAYER);
      expect(view?.task.penaltyCoins).toBe(clamped);
    });
  });

  describe('drawForClan', () => {
    beforeEach(() => {
      repo.query.mockResolvedValue([{ id: 'as9' }]);
      repo.findOne.mockResolvedValue(clanAssignment());
    });

    it('refuses while the season is not running', async () => {
      seasons.requireCurrent.mockResolvedValue({ id: 's1', status: 'open' });
      await expect(service.drawForClan(PLAYER, 1)).rejects.toThrow(
        /not started/,
      );
      expect(clans.requireLeader).not.toHaveBeenCalled();
      expect(repo.query).not.toHaveBeenCalled();
    });

    /** Only the leader starts a task, and only for a full clan. */
    it('asks the clan whether this player leads it', async () => {
      await service.drawForClan(PLAYER, 1);
      expect(clans.requireLeader).toHaveBeenCalledWith('e1');
    });

    it('passes on the clan’s refusal', async () => {
      clans.requireLeader.mockRejectedValue(
        new ForbiddenException('Only the clan leader can start a task.'),
      );
      await expect(service.drawForClan(PLAYER, 1)).rejects.toThrow(
        ForbiddenException,
      );
      clans.requireLeader.mockRejectedValue(
        new ConflictException('Your clan needs a second person'),
      );
      await expect(service.drawForClan(PLAYER, 1)).rejects.toThrow(
        /second person/,
      );
      expect(repo.query).not.toHaveBeenCalled();
    });

    it('refuses while a clock is already running', async () => {
      getOne.mockResolvedValue(
        clanAssignment({ status: 'accepted', expiresAt: inMinutes(10) }),
      );
      await expect(service.drawForClan(PLAYER, 1)).rejects.toThrow(
        /already have a task on the clock/,
      );
      expect(repo.query).not.toHaveBeenCalled();
    });

    it('returns the clan’s offer already waiting', async () => {
      getOne.mockResolvedValue(clanAssignment());
      const view = await service.drawForClan(PLAYER, 1);
      expect(view.id).toBe('as9');
      expect(view.clanId).toBe('c1');
      expect(repo.query).not.toHaveBeenCalled();
    });

    /** The leader holds one row; a solo offer in the way must be settled. */
    it('refuses while the leader is holding a solo offer', async () => {
      getOne.mockResolvedValue(assignment());
      await expect(service.drawForClan(PLAYER, 1)).rejects.toThrow(
        /holding a solo task/,
      );
      expect(repo.query).not.toHaveBeenCalled();
    });

    it('draws a team task at random and pins it to the clan', async () => {
      await service.drawForClan(PLAYER, 2);
      const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/INSERT INTO "game_task_assignments"/);
      expect(sql).toMatch(/"clanId"/);
      expect(sql).toMatch(/"mode" = 'team'/);
      expect(sql).toMatch(/ORDER BY random\(\)/);
      expect(sql).toMatch(/NOT EXISTS/);
      expect(params).toEqual(['s1', 'e1', 2, 'c1']);
    });

    it('says so when no team task is left for them', async () => {
      repo.query.mockResolvedValue([]);
      await expect(service.drawForClan(PLAYER, 1)).rejects.toThrow(
        /no team tasks left/,
      );
    });
  });

  describe('current', () => {
    it('is null when nothing is held', async () => {
      await expect(service.current(PLAYER)).resolves.toBeNull();
    });

    it('is the offer or the clock, whichever is held', async () => {
      getOne.mockResolvedValue(
        assignment({ status: 'accepted', expiresAt: inMinutes(5) }),
      );
      const view = await service.current(PLAYER);
      expect(view?.status).toBe('accepted');
    });
  });

  describe('accept', () => {
    it('refuses while another task is on the clock', async () => {
      getOne.mockResolvedValue(assignment({ id: 'other', status: 'accepted' }));
      await expect(service.accept(PLAYER, 'as1')).rejects.toThrow(
        /already have a task on the clock/,
      );
      expect(repo.query).not.toHaveBeenCalled();
    });

    /** One statement, so two taps cannot start two clocks. */
    it('starts the clock from the snapshotted minutes, in one statement', async () => {
      repo.query.mockResolvedValue([{ id: 'as1' }]);
      repo.findOne.mockResolvedValue(
        assignment({
          status: 'accepted',
          acceptedAt: new Date(),
          expiresAt: inMinutes(15),
        }),
      );
      const view = await service.accept(PLAYER, 'as1');
      const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/make_interval/);
      expect(sql).toMatch(/"status" = 'offered'/);
      expect(sql).toMatch(/"clockMinutes"/);
      expect(params).toEqual(['as1', 'e1']);
      expect(view.status).toBe('accepted');
    });

    it('counts down from expiresAt', async () => {
      repo.query.mockResolvedValue([{ id: 'as1' }]);
      repo.findOne.mockResolvedValue(
        assignment({
          status: 'accepted',
          acceptedAt: new Date(),
          expiresAt: inMinutes(10),
        }),
      );
      const view = await service.accept(PLAYER, 'as1');
      expect(view.secondsLeft).toBeGreaterThan(590);
      expect(view.secondsLeft).toBeLessThanOrEqual(600);
      expect(view.expiresAt).toEqual(expect.any(String));
    });

    /** A double-tapped Accept is not an error. */
    it('is idempotent once accepted', async () => {
      repo.query.mockResolvedValue([]);
      repo.findOne.mockResolvedValue(
        assignment({
          status: 'accepted',
          acceptedAt: new Date(),
          expiresAt: inMinutes(9),
        }),
      );
      const view = await service.accept(PLAYER, 'as1');
      expect(view.status).toBe('accepted');
    });

    it.each(['declined', 'expired', 'submitted'])(
      'refuses a task that is already %s',
      async (status) => {
        repo.query.mockResolvedValue([]);
        repo.findOne.mockResolvedValue(assignment({ status }));
        await expect(service.accept(PLAYER, 'as1')).rejects.toThrow(
          new RegExp(`already ${status}`),
        );
      },
    );

    it("cannot accept another player's task", async () => {
      repo.query.mockResolvedValue([]);
      repo.findOne.mockResolvedValue(null);
      await expect(service.accept(PLAYER, 'theirs')).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'theirs', enrolmentId: 'e1' } }),
      );
    });
  });

  describe('decline', () => {
    beforeEach(() => {
      repo.query.mockResolvedValue([{ id: 'as1' }]);
      repo.findOne.mockResolvedValue(
        assignment({ status: 'declined', heartBurned: true }),
      );
    });

    /** Before or after accepting — saying no costs the same. */
    it('closes an offer or a running clock alike', async () => {
      await service.decline(PLAYER, 'as1');
      const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/'declined'/);
      expect(sql).toMatch(/'offered', 'accepted'/);
      expect(sql).toMatch(/"heartBurned" = true/);
      expect(params).toEqual(['as1', 'e1']);
    });

    it('costs a heart', async () => {
      const outcome = await service.decline(PLAYER, 'as1');
      expect(discipline.burnHearts).toHaveBeenCalledWith(['e1'], 'declined');
      expect(outcome).toMatchObject({ heartsRemaining: 2, demoted: false });
      expect(outcome.assignment.status).toBe('declined');
      expect(outcome.assignment.heartBurned).toBe(true);
    });

    it('reports when that was the last one', async () => {
      discipline.burnHearts.mockResolvedValue([
        { enrolmentId: 'e1', userId: 'u1', heartsRemaining: 0, demoted: true },
      ]);
      const outcome = await service.decline(PLAYER, 'as1');
      expect(outcome).toMatchObject({ heartsRemaining: 0, demoted: true });
    });

    /** A solo task has no coin penalty and no second person to charge. */
    it('charges no coins and touches nobody else for a solo task', async () => {
      await service.decline(PLAYER, 'as1');
      expect(discipline.burnHearts).toHaveBeenCalledWith(['e1'], 'declined');
      expect(clans.memberEnrolmentIds).not.toHaveBeenCalled();
      expect(economy.move).not.toHaveBeenCalled();
    });

    describe('for a clan task', () => {
      beforeEach(() => {
        repo.findOne.mockResolvedValue(
          clanAssignment({ status: 'declined', heartBurned: true }),
        );
        discipline.burnHearts.mockResolvedValue([
          {
            enrolmentId: 'e1',
            userId: 'u1',
            heartsRemaining: 2,
            demoted: false,
          },
          {
            enrolmentId: 'e2',
            userId: 'u2',
            heartsRemaining: 0,
            demoted: true,
          },
        ]);
      });

      /** The task was the clan's, so the heart and the coins are too. */
      it('burns a heart on both members', async () => {
        await service.decline(PLAYER, 'as9');
        expect(clans.memberEnrolmentIds).toHaveBeenCalledWith('c1');
        expect(discipline.burnHearts).toHaveBeenCalledWith(
          ['e1', 'e2'],
          'declined',
        );
      });

      it('charges the template’s penalty from both, through the ledger', async () => {
        await service.decline(PLAYER, 'as9');
        expect(economy.move).toHaveBeenCalledWith(['e1', 'e2'], {
          coins: -2,
          reason: 'task_penalty',
          refType: 'assignment',
          refId: 'as9',
        });
        expect(economy.announce).toHaveBeenCalled();
      });

      it.each([
        [5, -3],
        [0, -1],
      ])('clamps a template penalty of %s to %s coins', async (raw, moved) => {
        repo.findOne.mockResolvedValue(
          clanAssignment({
            status: 'declined',
            taskTemplate: { ...TEMPLATE, penaltyCoins: raw },
          }),
        );
        await service.decline(PLAYER, 'as9');
        expect(economy.move).toHaveBeenCalledWith(
          ['e1', 'e2'],
          expect.objectContaining({ coins: moved }),
        );
      });

      /** The caller learns about their own hearts, not their partner's. */
      it('reports the caller’s own burn', async () => {
        const outcome = await service.decline(PLAYER, 'as9');
        expect(outcome).toMatchObject({ heartsRemaining: 2, demoted: false });
        expect(outcome.assignment.clanId).toBe('c1');
      });
    });

    /** A second decline must not burn a second heart. */
    it('refuses a task already settled, and burns nothing', async () => {
      repo.query.mockResolvedValue([]);
      repo.findOne.mockResolvedValue(assignment({ status: 'submitted' }));
      await expect(service.decline(PLAYER, 'as1')).rejects.toThrow(
        /already submitted/,
      );
      expect(discipline.burnHearts).not.toHaveBeenCalled();
    });

    it("is not found for another player's task", async () => {
      repo.query.mockResolvedValue([]);
      repo.findOne.mockResolvedValue(null);
      await expect(service.decline(PLAYER, 'theirs')).rejects.toThrow(
        NotFoundException,
      );
      expect(discipline.burnHearts).not.toHaveBeenCalled();
    });
  });

  describe('requireOpen', () => {
    it('returns an accepted task with time left', async () => {
      const open = assignment({ status: 'accepted', expiresAt: inMinutes(5) });
      repo.findOne.mockResolvedValue(open);
      await expect(service.requireOpen('e1', 'as1')).resolves.toBe(open);
      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'as1' } }),
      );
      expect(clans.isMember).not.toHaveBeenCalled();
    });

    /** A clan task is held by the leader, but either member hands in. */
    it('lets a clan member open the clan’s task', async () => {
      const open = clanAssignment({
        status: 'accepted',
        expiresAt: inMinutes(5),
      });
      repo.findOne.mockResolvedValue(open);
      clans.isMember.mockResolvedValue(true);
      await expect(service.requireOpen('e2', 'as9')).resolves.toBe(open);
      expect(clans.isMember).toHaveBeenCalledWith('c1', 'e2');
    });

    it('is not found for somebody outside the clan', async () => {
      repo.findOne.mockResolvedValue(
        clanAssignment({ status: 'accepted', expiresAt: inMinutes(5) }),
      );
      clans.isMember.mockResolvedValue(false);
      await expect(service.requireOpen('e3', 'as9')).rejects.toThrow(
        NotFoundException,
      );
    });

    /** No clan means no membership to check — a stranger is simply not found. */
    it('never consults the clan for a solo task', async () => {
      repo.findOne.mockResolvedValue(
        assignment({ status: 'accepted', expiresAt: inMinutes(5) }),
      );
      await expect(service.requireOpen('e2', 'as1')).rejects.toThrow(
        NotFoundException,
      );
      expect(clans.isMember).not.toHaveBeenCalled();
    });

    it('tells an offer to be accepted first', async () => {
      repo.findOne.mockResolvedValue(assignment());
      await expect(service.requireOpen('e1', 'as1')).rejects.toThrow(
        /Accept the task before you hand in/,
      );
    });

    it('names the state of a task that is already closed', async () => {
      repo.findOne.mockResolvedValue(assignment({ status: 'declined' }));
      await expect(service.requireOpen('e1', 'as1')).rejects.toThrow(
        /already declined/,
      );
    });

    /**
     * Overdue and not yet swept: settled on the spot rather than letting the
     * player find out at the next minute boundary — and a heart goes with it.
     */
    it('expires a clock that has already run out, then refuses', async () => {
      repo.findOne.mockResolvedValue(
        assignment({ status: 'accepted', expiresAt: inMinutes(-1) }),
      );
      repo.query.mockResolvedValue([{ id: 'as1', enrolmentId: 'e1' }]);
      await expect(service.requireOpen('e1', 'as1')).rejects.toThrow(
        /Time ran out/,
      );
      const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/'expired'/);
      expect(sql).toMatch(/"id" = \$1::uuid/);
      expect(params).toEqual(['as1']);
      expect(discipline.burnHearts).toHaveBeenCalledWith(['e1'], 'expired');
    });

    it('is not found for a task that is not theirs', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.requireOpen('e1', 'as1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('closeWithAttempt', () => {
    it('closes the task with the hand-in while the clock is ahead', async () => {
      repo.query.mockResolvedValue([{ id: 'as1' }]);
      await expect(service.closeWithAttempt('as1', 'e1', 'a1')).resolves.toBe(
        true,
      );
      const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/'submitted'/);
      expect(sql).toMatch(/"expiresAt" > now\(\)/);
      expect(sql).toMatch(/"status" = 'accepted'/);
      expect(params).toEqual(['as1', 'e1', 'a1']);
    });

    /** The holder, or anyone in the clan that holds it. */
    it('lets a clan member close the clan’s task', async () => {
      repo.query.mockResolvedValue([{ id: 'as9' }]);
      await service.closeWithAttempt('as9', 'e2', 'a1');
      const [sql] = repo.query.mock.calls[0] as [string];
      expect(sql).toMatch(/game_clan_members/);
      expect(sql).toMatch(/"clanId" IS NOT NULL/);
    });

    /** The database decides lateness; the service only reports it. */
    it('reports false once the clock has run out', async () => {
      repo.query.mockResolvedValue([]);
      await expect(service.closeWithAttempt('as1', 'e1', 'a1')).resolves.toBe(
        false,
      );
    });
  });

  describe('the clock', () => {
    it('does nothing when nothing is overdue', async () => {
      repo.query.mockResolvedValue([]);
      await expect(service.expireOverdue()).resolves.toEqual({
        expired: 0,
        burns: [],
      });
      expect(discipline.burnHearts).not.toHaveBeenCalled();
    });

    it('expires every overdue clock and burns a heart for each', async () => {
      repo.query.mockResolvedValue([
        { id: 'as1', enrolmentId: 'e1' },
        { id: 'as2', enrolmentId: 'e2' },
      ]);
      discipline.burnHearts.mockResolvedValue([
        { enrolmentId: 'e1', userId: 'u1', heartsRemaining: 2, demoted: false },
        { enrolmentId: 'e2', userId: 'u2', heartsRemaining: 0, demoted: true },
      ]);
      const result = await service.expireOverdue();
      const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/"status" = 'accepted'/);
      expect(sql).toMatch(/"expiresAt" <= now\(\)/);
      expect(params).toEqual([null]);
      expect(discipline.burnHearts).toHaveBeenCalledWith(
        ['e1', 'e2'],
        'expired',
      );
      expect(result.expired).toBe(2);
      expect(result.burns.filter((b) => b.demoted)).toHaveLength(1);
    });

    /**
     * A solo clock burns its holder in the batch; a clan's goes through the
     * clan failure so both members pay, hearts and coins alike.
     */
    it('settles a clan’s clock on both members', async () => {
      repo.query.mockResolvedValue([
        { id: 'as1', enrolmentId: 'e1', clanId: null },
        { id: 'as9', enrolmentId: 'e3', clanId: 'c1' },
      ]);
      repo.findOne.mockResolvedValue(
        clanAssignment({ status: 'expired', enrolmentId: 'e3' }),
      );
      discipline.burnHearts
        .mockResolvedValueOnce([
          {
            enrolmentId: 'e1',
            userId: 'u1',
            heartsRemaining: 2,
            demoted: false,
          },
        ])
        .mockResolvedValueOnce([
          {
            enrolmentId: 'e1',
            userId: 'u1',
            heartsRemaining: 1,
            demoted: false,
          },
          {
            enrolmentId: 'e2',
            userId: 'u2',
            heartsRemaining: 0,
            demoted: true,
          },
        ]);

      const result = await service.expireOverdue();

      expect(discipline.burnHearts).toHaveBeenNthCalledWith(
        1,
        ['e1'],
        'expired',
      );
      expect(discipline.burnHearts).toHaveBeenNthCalledWith(
        2,
        ['e1', 'e2'],
        'expired',
      );
      expect(economy.move).toHaveBeenCalledTimes(1);
      expect(economy.move).toHaveBeenCalledWith(['e1', 'e2'], {
        coins: -2,
        reason: 'task_penalty',
        refType: 'assignment',
        refId: 'as9',
      });
      expect(result.expired).toBe(2);
      expect(result.burns).toHaveLength(3);
      expect(result.burns.filter((b) => b.demoted)).toHaveLength(1);
    });

    it('charges no coins for a solo clock', async () => {
      repo.query.mockResolvedValue([
        { id: 'as1', enrolmentId: 'e1', clanId: null },
      ]);
      await service.expireOverdue();
      expect(economy.move).not.toHaveBeenCalled();
    });

    it('runs the sweep on one instance', async () => {
      repo.query.mockResolvedValue([]);
      await service.sweepClocks();
      expect(leaderLock.withLock).toHaveBeenCalledWith(
        'gameTaskClock',
        expect.any(Number),
        expect.any(Function),
      );
      expect(repo.query).toHaveBeenCalledTimes(1);
    });

    /** A throw must never escape into the scheduler. */
    it('logs a failing sweep rather than rethrowing', async () => {
      repo.query.mockRejectedValue(new Error('connection reset'));
      await expect(service.sweepClocks()).resolves.toBeUndefined();
    });
  });
});
