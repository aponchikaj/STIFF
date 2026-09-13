import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { LeaderLockService } from '../common/redis/leader-lock.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { User } from '../users/user.entity';
import { EconomyService } from './economy.service';
import { GameClan, GameClanMember } from './entities/game-clan.entity';
import { GameClanWar, GameWarBet } from './entities/game-clan-war.entity';
import { GameEnrolment } from './entities/game-enrolment.entity';
import { EnrolmentsService } from './enrolments.service';
import { SeasonsService } from './seasons.service';
import { WarsService } from './wars.service';

/**
 * Clan wars.
 *
 * The book's arithmetic is proven in `rules.spec.ts` and the SQL against the
 * real schema in a rolled-back probe. What these hold is the part in
 * between: the rules about who may do what, and when. Every one of them is
 * a way to cheat the book if it is wrong.
 */

const HOUR = 3_600_000;
const USER = { id: 'u1' } as User;

function enrolment(over: Partial<GameEnrolment> = {}): GameEnrolment {
  return {
    id: 'e-bettor',
    seasonId: 's1',
    userId: 'u1',
    role: 'player',
    status: 'active',
    coins: 500,
    ...over,
  } as GameEnrolment;
}

function war(over: Partial<GameClanWar> = {}): GameClanWar {
  return {
    id: 'w1',
    seasonId: 's1',
    challengerClanId: 'c-red',
    opponentClanId: 'c-blue',
    proposedById: 'e-red-lead',
    status: 'accepted',
    startsAt: new Date(Date.now() + 2 * HOUR),
    endsAt: new Date(Date.now() + 6 * HOUR),
    rakePercent: 10,
    challengerScore: 0,
    opponentScore: 0,
    outcome: null,
    winnerClanId: null,
    settlementReason: null,
    voidReason: null,
    settledAt: null,
    acceptedAt: new Date(),
    challengerClan: { name: 'Red' } as GameClan,
    opponentClan: { name: 'Blue' } as GameClan,
    ...over,
  } as GameClanWar;
}

/**
 * A transaction manager that answers by what the SQL is asking. Each case
 * sets only the answers it cares about; anything unset returns no rows.
 */
function fakeManager() {
  const answers: {
    war?: GameClanWar;
    clans?: Partial<GameClan>[];
    atWar?: number;
    pending?: number;
    scores?: { clanId: string; score: number }[];
    bets?: unknown[];
  } = {};
  const findOne = jest.fn().mockResolvedValue(null);
  const query = jest.fn((sql: string) => {
    if (sql.includes('FROM "game_clan_wars" WHERE "id" = $1 FOR UPDATE')) {
      return Promise.resolve(answers.war ? [answers.war] : []);
    }
    if (sql.includes('FROM "game_clans" WHERE "id" = ANY')) {
      return Promise.resolve(answers.clans ?? []);
    }
    if (sql.includes("\"status\" IN ('accepted', 'live', 'judging')")) {
      return Promise.resolve([{ n: answers.atWar ?? 0 }]);
    }
    if (sql.includes('"status" = \'submitted\'')) {
      return Promise.resolve([{ n: answers.pending ?? 0 }]);
    }
    if (sql.includes('FROM "game_score_ledger"')) {
      return Promise.resolve(answers.scores ?? []);
    }
    if (sql.includes('FROM "game_war_bets" b')) {
      return Promise.resolve(answers.bets ?? []);
    }
    if (sql.includes('INSERT INTO "game_clan_wars"')) {
      return Promise.resolve([{ id: 'w-new' }]);
    }
    return Promise.resolve([]);
  });
  return { manager: { query, findOne }, answers, query, findOne };
}

describe('WarsService', () => {
  let service: WarsService;
  let fake: ReturnType<typeof fakeManager>;
  let enrolments: { require: jest.Mock; mine: jest.Mock };
  let seasons: { requireCurrent: jest.Mock; current: jest.Mock };
  let economy: { charge: jest.Mock; move: jest.Mock };
  let warRepo: { findOne: jest.Mock; find: jest.Mock; query: jest.Mock };
  let betRepo: { findOne: jest.Mock; find: jest.Mock; query: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    fake = fakeManager();
    enrolments = {
      require: jest.fn().mockResolvedValue(enrolment({ id: 'e-red-lead' })),
      mine: jest.fn().mockResolvedValue(null),
    };
    seasons = {
      requireCurrent: jest
        .fn()
        .mockResolvedValue({ id: 's1', status: 'running' }),
      current: jest.fn().mockResolvedValue({ id: 's1', status: 'running' }),
    };
    economy = {
      charge: jest.fn().mockResolvedValue({}),
      move: jest.fn().mockResolvedValue([]),
    };
    warRepo = {
      findOne: jest.fn().mockResolvedValue(war()),
      find: jest.fn().mockResolvedValue([]),
      query: jest.fn().mockResolvedValue([]),
    };
    betRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      query: jest.fn().mockResolvedValue([]),
    };
    config = { get: jest.fn().mockReturnValue(undefined) };

    const dataSource = {
      transaction: jest.fn((cb: (m: unknown) => Promise<unknown>) =>
        cb(fake.manager),
      ),
      manager: fake.manager,
      getRepository: jest.fn(() => ({
        findOne: jest.fn().mockResolvedValue(null),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarsService,
        { provide: getRepositoryToken(GameClanWar), useValue: warRepo },
        { provide: getRepositoryToken(GameWarBet), useValue: betRepo },
        {
          provide: getRepositoryToken(GameClan),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(GameClanMember),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
          },
        },
        { provide: DataSource, useValue: dataSource },
        { provide: SeasonsService, useValue: seasons },
        { provide: EnrolmentsService, useValue: enrolments },
        { provide: EconomyService, useValue: economy },
        { provide: NotificationsService, useValue: { notify: jest.fn() } },
        { provide: LeaderLockService, useValue: { withLock: jest.fn() } },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(WarsService);
  });

  /** Seats the caller as leader of a full clan. */
  function leaderOf(clanId: string) {
    fake.findOne.mockImplementation((entity: unknown) => {
      if (entity === GameClanMember) {
        return Promise.resolve({ clanId, role: 'leader' });
      }
      if (entity === GameClan) {
        return Promise.resolve({ id: clanId, status: 'full', seasonId: 's1' });
      }
      return Promise.resolve(null);
    });
  }

  // ================================================================ propose

  describe('propose', () => {
    const inTwoHours = () => new Date(Date.now() + 2 * HOUR).toISOString();

    beforeEach(() => {
      leaderOf('c-red');
      fake.answers.clans = [
        { id: 'c-red', status: 'full', seasonId: 's1' },
        { id: 'c-blue', status: 'full', seasonId: 's1' },
      ];
    });

    it('only happens while the season is running', async () => {
      seasons.requireCurrent.mockResolvedValue({ id: 's1', status: 'open' });
      await expect(
        service.propose(USER, {
          opponentClanId: 'c-blue',
          startsAt: inTwoHours(),
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('needs the caller to lead their clan', async () => {
      fake.findOne.mockImplementation((entity: unknown) =>
        Promise.resolve(
          entity === GameClanMember
            ? { clanId: 'c-red', role: 'member' }
            : null,
        ),
      );
      await expect(
        service.propose(USER, {
          opponentClanId: 'c-blue',
          startsAt: inTwoHours(),
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuses a war with your own clan', async () => {
      await expect(
        service.propose(USER, {
          opponentClanId: 'c-red',
          startsAt: inTwoHours(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses an opponent that has not filled its roster', async () => {
      fake.answers.clans = [
        { id: 'c-red', status: 'full', seasonId: 's1' },
        { id: 'c-blue', status: 'forming', seasonId: 's1' },
      ];
      await expect(
        service.propose(USER, {
          opponentClanId: 'c-blue',
          startsAt: inTwoHours(),
        }),
      ).rejects.toThrow(/second seat/);
    });

    /** The book closes at the start. Too soon, and nobody can bet. */
    it('refuses a start too soon for anyone to bet', async () => {
      const inTenMinutes = new Date(Date.now() + 10 * 60_000).toISOString();
      await expect(
        service.propose(USER, {
          opponentClanId: 'c-blue',
          startsAt: inTenMinutes,
        }),
      ).rejects.toThrow(/at least 30 minutes/);
    });

    it('refuses a start more than a week out', async () => {
      const inTenDays = new Date(Date.now() + 240 * HOUR).toISOString();
      await expect(
        service.propose(USER, {
          opponentClanId: 'c-blue',
          startsAt: inTenDays,
        }),
      ).rejects.toThrow(/7 days/);
    });

    it('refuses a start that is not a date', async () => {
      await expect(
        service.propose(USER, {
          opponentClanId: 'c-blue',
          startsAt: 'tomorrow-ish',
        }),
      ).rejects.toThrow(/not a date/);
    });

    /** Neither clan can be in two wars at once. */
    it('refuses when either clan is already at war', async () => {
      fake.answers.atWar = 1;
      await expect(
        service.propose(USER, {
          opponentClanId: 'c-blue',
          startsAt: inTwoHours(),
        }),
      ).rejects.toThrow(/already in a war/);
    });

    /** Locked in id order, so two challenges crossing cannot deadlock. */
    it('locks both clans in a stable order before checking', async () => {
      await service.propose(USER, {
        opponentClanId: 'c-blue',
        startsAt: inTwoHours(),
      });
      const lock = fake.query.mock.calls.find(([sql]) =>
        sql.includes('FROM "game_clans" WHERE "id" = ANY'),
      ) as unknown as [string, unknown[]];
      expect(lock[0]).toContain('ORDER BY "id" FOR UPDATE');
      expect(lock[1][0]).toEqual(['c-blue', 'c-red']);
    });

    it('files the war as proposed, four hours long', async () => {
      const startsAt = inTwoHours();
      await service.propose(USER, { opponentClanId: 'c-blue', startsAt });
      const insert = fake.query.mock.calls.find(([sql]) =>
        sql.includes('INSERT INTO "game_clan_wars"'),
      ) as unknown as [string, unknown[]];
      const [, , , , start, end] = insert[1] as [
        unknown,
        unknown,
        unknown,
        unknown,
        Date,
        Date,
      ];
      expect(insert[0]).toContain("'proposed'");
      expect(end.getTime() - start.getTime()).toBe(4 * HOUR);
    });
  });

  // ================================================================= accept

  describe('accept', () => {
    beforeEach(() => {
      fake.answers.war = war({ status: 'proposed' });
      fake.answers.clans = [
        { id: 'c-red', status: 'full' },
        { id: 'c-blue', status: 'full' },
      ];
    });

    it('is only for the challenged leader', async () => {
      leaderOf('c-red'); // the challenger, not the challenged
      await expect(service.accept(USER, 'w1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('refuses a challenge that is no longer open', async () => {
      leaderOf('c-blue');
      fake.answers.war = war({ status: 'void' });
      await expect(service.accept(USER, 'w1')).rejects.toThrow(
        /no longer open/,
      );
    });

    it('refuses when the start is too close for a book', async () => {
      leaderOf('c-blue');
      fake.answers.war = war({
        status: 'proposed',
        startsAt: new Date(Date.now() + 5 * 60_000),
      });
      await expect(service.accept(USER, 'w1')).rejects.toThrow(/too close/);
    });

    /**
     * The house's cut is frozen at accept. Configuration changes, and reading
     * it at settlement would let a change mid-war move a bet already placed.
     */
    it('freezes the rake at the moment it opens the book', async () => {
      leaderOf('c-blue');
      config.get.mockImplementation((k: string) =>
        k === 'GAME_WAR_RAKE_PERCENT' ? '15' : undefined,
      );
      await service.accept(USER, 'w1');
      const update = fake.query.mock.calls.find(([sql]) =>
        sql.includes('SET "status" = \'accepted\''),
      ) as unknown as [string, unknown[]];
      expect(update[1]).toEqual(['w1', 15]);
    });
  });

  // =================================================================== bets

  describe('placeBet', () => {
    beforeEach(() => {
      enrolments.require.mockResolvedValue(enrolment());
      fake.answers.war = war();
    });

    it('charges the stake and writes the bet in the same transaction', async () => {
      await service.placeBet(USER, 'w1', { side: 'challenger', coins: 40 });
      expect(economy.charge).toHaveBeenCalledWith(
        'e-bettor',
        40,
        { reason: 'war_stake', refType: 'war', refId: 'w1' },
        fake.manager,
      );
      expect(
        fake.query.mock.calls.some(([sql]) =>
          sql.includes('INSERT INTO "game_war_bets"'),
        ),
      ).toBe(true);
    });

    /** The one rule that is about the game rather than the book. */
    it.each([['c-red'], ['c-blue']])(
      'bars a member of %s from betting on their own war',
      async (clanId) => {
        fake.findOne.mockImplementation((entity: unknown) =>
          Promise.resolve(
            entity === GameClanMember ? { clanId, role: 'member' } : null,
          ),
        );
        await expect(
          service.placeBet(USER, 'w1', { side: 'opponent', coins: 10 }),
        ).rejects.toThrow(/fighting in this war/);
        expect(economy.charge).not.toHaveBeenCalled();
      },
    );

    it('bars a flagged cheater', async () => {
      enrolments.require.mockResolvedValue(enrolment({ status: 'cheater' }));
      await expect(
        service.placeBet(USER, 'w1', { side: 'challenger', coins: 10 }),
      ).rejects.toThrow(/cheating/);
    });

    /** Nobody bets knowing how it is going. */
    it('closes the book the moment the war starts', async () => {
      fake.answers.war = war({
        status: 'accepted',
        startsAt: new Date(Date.now() - 1000),
      });
      await expect(
        service.placeBet(USER, 'w1', { side: 'challenger', coins: 10 }),
      ).rejects.toThrow(/closed/);
      expect(economy.charge).not.toHaveBeenCalled();
    });

    it.each([['proposed'], ['live'], ['settled']] as const)(
      'refuses a bet on a war that is %s',
      async (status) => {
        fake.answers.war = war({ status });
        await expect(
          service.placeBet(USER, 'w1', { side: 'challenger', coins: 10 }),
        ).rejects.toThrow(/closed/);
      },
    );

    /** Two rows on opposite sides is only ever laundering coins. */
    it('will not let a bet switch sides', async () => {
      fake.findOne.mockImplementation((entity: unknown) =>
        Promise.resolve(
          entity === GameWarBet ? { side: 'challenger', stakeCoins: 20 } : null,
        ),
      );
      await expect(
        service.placeBet(USER, 'w1', { side: 'opponent', coins: 10 }),
      ).rejects.toThrow(/cannot switch sides/);
      expect(economy.charge).not.toHaveBeenCalled();
    });

    it('caps what one person can have on one war, counting top-ups', async () => {
      fake.findOne.mockImplementation((entity: unknown) =>
        Promise.resolve(
          entity === GameWarBet
            ? { side: 'challenger', stakeCoins: 490 }
            : null,
        ),
      );
      await expect(
        service.placeBet(USER, 'w1', { side: 'challenger', coins: 20 }),
      ).rejects.toThrow(/most anyone can stake/);
    });

    it('refuses a stake below one coin', async () => {
      await expect(
        service.placeBet(USER, 'w1', { side: 'challenger', coins: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    /** A stake the balance cannot cover never becomes a bet. */
    it('writes no bet when the balance cannot cover it', async () => {
      economy.charge.mockRejectedValue(
        new ConflictException('Not enough coins.'),
      );
      await expect(
        service.placeBet(USER, 'w1', { side: 'challenger', coins: 40 }),
      ).rejects.toThrow('Not enough coins.');
      expect(
        fake.query.mock.calls.some(([sql]) =>
          sql.includes('INSERT INTO "game_war_bets"'),
        ),
      ).toBe(false);
    });
  });

  // ================================================================= settle

  describe('settle', () => {
    const ended = (over: Partial<GameClanWar> = {}) =>
      war({
        status: 'judging',
        startsAt: new Date(Date.now() - 5 * HOUR),
        endsAt: new Date(Date.now() - HOUR),
        ...over,
      });

    const bet = (id: string, side: string, stakeCoins: number) => ({
      id,
      side,
      stakeCoins,
      enrolmentId: `e-${id}`,
      userId: `u-${id}`,
    });

    beforeEach(() => {
      fake.answers.war = ended();
    });

    /** A clan should not lose because its best clip is still in the queue. */
    it('waits while a hand-in from the window is unjudged', async () => {
      fake.answers.pending = 2;
      await service.settle('w1');
      expect(
        fake.query.mock.calls.some(([sql]) =>
          sql.includes('SET "status" = \'settled\''),
        ),
      ).toBe(false);
    });

    it('settles anyway once the judging deadline has passed', async () => {
      fake.answers.pending = 2;
      fake.answers.war = ended({ endsAt: new Date(Date.now() - 49 * HOUR) });
      await service.settle('w1');
      expect(
        fake.query.mock.calls.some(([sql]) =>
          sql.includes('SET "status" = \'settled\''),
        ),
      ).toBe(true);
    });

    it('settles when forced, even with hand-ins pending', async () => {
      fake.answers.pending = 5;
      await service.settle('w1', { force: true });
      const update = fake.query.mock.calls.find(([sql]) =>
        sql.includes('SET "status" = \'settled\''),
      );
      expect(update).toBeDefined();
    });

    it('declares the clan with more Nerve the winner and pays its backers', async () => {
      fake.answers.scores = [
        { clanId: 'c-red', score: 80 },
        { clanId: 'c-blue', score: 30 },
      ];
      fake.answers.bets = [
        bet('a', 'challenger', 100),
        bet('b', 'opponent', 100),
      ];
      await service.settle('w1');

      const update = fake.query.mock.calls.find(([sql]) =>
        sql.includes('SET "status" = \'settled\''),
      ) as unknown as [string, unknown[]];
      // outcome, winner, scores, reason, rake
      expect(update[1].slice(1)).toEqual([
        'challenger',
        'c-red',
        80,
        30,
        'paid',
        10,
      ]);
      // 100 back plus the loser's 100 less the 10% rake.
      expect(economy.move).toHaveBeenCalledWith(
        ['e-a'],
        { coins: 190, reason: 'war_payout', refType: 'war', refId: 'w1' },
        fake.manager,
      );
      // The loser is credited nothing.
      expect(economy.move).toHaveBeenCalledTimes(1);
    });

    it('refunds every stake on a draw', async () => {
      fake.answers.scores = [
        { clanId: 'c-red', score: 50 },
        { clanId: 'c-blue', score: 50 },
      ];
      fake.answers.bets = [
        bet('a', 'challenger', 30),
        bet('b', 'opponent', 70),
      ];
      await service.settle('w1');

      const reasons = economy.move.mock.calls.map(
        ([, m]) => (m as { reason: string }).reason,
      );
      expect(reasons).toEqual(['war_refund', 'war_refund']);
      const credited = economy.move.mock.calls.map(
        ([, m]) => (m as { coins: number }).coins,
      );
      expect(credited).toEqual([30, 70]);
    });

    /** Settling twice must not pay twice. */
    it('does nothing to a war that is already settled', async () => {
      fake.answers.war = ended({ status: 'settled' });
      await service.settle('w1');
      expect(economy.move).not.toHaveBeenCalled();
    });

    it('refuses to force-settle a war that has not started', async () => {
      fake.answers.war = war({ status: 'accepted' });
      await expect(service.settle('w1', { force: true })).rejects.toThrow(
        /has started/,
      );
    });
  });

  // =================================================================== void

  describe('voidWar', () => {
    it('gives every stake back and records why', async () => {
      fake.answers.war = war({ status: 'live' });
      fake.answers.bets = [
        {
          id: 'a',
          side: 'challenger',
          stakeCoins: 25,
          enrolmentId: 'e-a',
          userId: 'u-a',
        },
      ];
      await service.voidWar('w1', 'A clan was caught cheating.');

      expect(economy.move).toHaveBeenCalledWith(
        ['e-a'],
        { coins: 25, reason: 'war_refund', refType: 'war', refId: 'w1' },
        fake.manager,
      );
      const mark = fake.query.mock.calls.find(([sql]) =>
        sql.includes('SET "status" = \'void\''),
      ) as unknown as [string, unknown[]];
      expect(mark[1]).toEqual(['w1', 'A clan was caught cheating.']);
    });

    it('refuses a war that is already over', async () => {
      fake.answers.war = war({ status: 'settled' });
      await expect(service.voidWar('w1', 'too late')).rejects.toThrow(
        /already over/,
      );
    });
  });

  // =================================================================== tick

  describe('tick', () => {
    /** A challenge nobody answered in time is not left hanging open. */
    it('voids a challenge that was never accepted before its start', async () => {
      warRepo.find.mockResolvedValueOnce([
        { id: 'w-stale', startsAt: new Date(Date.now() - 1000) },
      ]);
      warRepo.find.mockResolvedValue([]);
      fake.answers.war = war({ id: 'w-stale', status: 'proposed' });

      const report = await service.tick();

      expect(report.voided).toBe(1);
      const mark = fake.query.mock.calls.find(([sql]) =>
        sql.includes('SET "status" = \'void\''),
      ) as unknown as [string, unknown[]];
      expect(mark[1][1]).toMatch(/not accepted/i);
    });

    it('starts accepted wars and ends live ones by the clock', async () => {
      warRepo.find.mockResolvedValue([]);
      warRepo.query
        .mockResolvedValueOnce([[{ id: 'a' }, { id: 'b' }], 2])
        .mockResolvedValueOnce([[{ id: 'c' }], 1]);

      const report = await service.tick();

      expect(report.started).toBe(2);
      expect(report.ended).toBe(1);
      const [[startSql], [endSql]] = warRepo.query.mock.calls as [string][];
      expect(startSql).toContain(
        '"status" = \'accepted\' AND "startsAt" <= $1',
      );
      expect(endSql).toContain('"status" = \'live\' AND "endsAt" <= $1');
    });
  });

  // =============================================================== organize

  describe('organize', () => {
    const inTwoHours = () => new Date(Date.now() + 2 * HOUR).toISOString();

    beforeEach(() => {
      fake.answers.clans = [
        { id: 'c-red', status: 'full', seasonId: 's1' },
        { id: 'c-blue', status: 'full', seasonId: 's1' },
      ];
      fake.findOne.mockImplementation((entity: unknown) =>
        Promise.resolve(
          entity === GameClanMember
            ? { enrolmentId: 'e-red-lead', role: 'leader' }
            : null,
        ),
      );
    });

    it('refuses a clan against itself', async () => {
      await expect(
        service.organize({
          challengerClanId: 'c-red',
          opponentClanId: 'c-red',
          startsAt: inTwoHours(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('only happens while the season is running', async () => {
      seasons.requireCurrent.mockResolvedValue({ id: 's1', status: 'open' });
      await expect(
        service.organize({
          challengerClanId: 'c-red',
          opponentClanId: 'c-blue',
          startsAt: inTwoHours(),
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('refuses a clan without a full roster', async () => {
      fake.answers.clans = [
        { id: 'c-red', status: 'full', seasonId: 's1' },
        { id: 'c-blue', status: 'forming', seasonId: 's1' },
      ];
      await expect(
        service.organize({
          challengerClanId: 'c-red',
          opponentClanId: 'c-blue',
          startsAt: inTwoHours(),
        }),
      ).rejects.toThrow(/full roster/);
    });

    /** The operator cannot put a clan into two wars either. */
    it('refuses when either clan is already at war', async () => {
      fake.answers.atWar = 1;
      await expect(
        service.organize({
          challengerClanId: 'c-red',
          opponentClanId: 'c-blue',
          startsAt: inTwoHours(),
        }),
      ).rejects.toThrow(/already in a war/);
    });

    /**
     * Skips the challenge, so it lands exactly where an accepted challenge
     * would: book open, rake frozen now.
     */
    it('files the war as accepted with the rake frozen', async () => {
      config.get.mockImplementation((k: string) =>
        k === 'GAME_WAR_RAKE_PERCENT' ? '12' : undefined,
      );
      await service.organize({
        challengerClanId: 'c-red',
        opponentClanId: 'c-blue',
        startsAt: inTwoHours(),
      });
      const insert = fake.query.mock.calls.find(([sql]) =>
        sql.includes('INSERT INTO "game_clan_wars"'),
      ) as unknown as [string, unknown[]];
      expect(insert[0]).toContain("'accepted'");
      expect(insert[1][3]).toBe('e-red-lead');
      expect(insert[1][6]).toBe(12);
    });
  });
});
