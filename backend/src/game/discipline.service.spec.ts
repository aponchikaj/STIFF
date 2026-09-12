import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { LeaderLockService } from '../common/redis/leader-lock.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DisciplineService } from './discipline.service';
import { GameEnrolment } from './entities/game-enrolment.entity';
import { GameSeason } from './entities/game-season.entity';
import { SeasonsService } from './seasons.service';

/**
 * The four ways a player becomes a watcher, and the one way back.
 *
 * Every demotion is one conditional statement, so what these hold is mostly
 * the SQL: that the condition is in the `WHERE`, that the right values are
 * bound, and that an empty `RETURNING` is read as "nothing moved" rather than
 * as success.
 */

const WINDOW = {
  start: '2026-09-10T20:00:00.000Z',
  end: '2026-09-11T20:00:00.000Z',
};

function season(overrides: Partial<GameSeason> = {}): GameSeason {
  return {
    id: 's1',
    slug: 'zero',
    title: 'Season Zero',
    status: 'running',
    startsAt: new Date('2026-09-01T00:00:00.000Z'),
    ...overrides,
  } as GameSeason;
}

describe('DisciplineService', () => {
  let service: DisciplineService;
  let repo: { query: jest.Mock; findOne: jest.Mock };
  let manager: { query: jest.Mock; findOne: jest.Mock };
  let seasons: { current: jest.Mock };
  let notifications: { notify: jest.Mock };
  let leaderLock: { withLock: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    repo = {
      query: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'e1', status: 'active' }),
    };
    manager = {
      query: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    seasons = { current: jest.fn().mockResolvedValue(season()) };
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    leaderLock = {
      withLock: jest.fn(
        (_name: string, _ttl: number, job: () => Promise<unknown>) => job(),
      ),
    };
    config = { get: jest.fn().mockReturnValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisciplineService,
        { provide: getRepositoryToken(GameEnrolment), useValue: repo },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((cb: (m: unknown) => Promise<unknown>) =>
              cb(manager),
            ),
          },
        },
        { provide: SeasonsService, useValue: seasons },
        { provide: NotificationsService, useValue: notifications },
        { provide: LeaderLockService, useValue: leaderLock },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(DisciplineService);
  });

  describe('flagCheater', () => {
    beforeEach(() => {
      manager.query.mockResolvedValueOnce([{ id: 'e1', userId: 'u1' }]);
      repo.findOne.mockResolvedValue({ id: 'e1', status: 'cheater' });
    });

    it('zeroes the account in one statement that only touches a non-cheater', async () => {
      await service.flagCheater('e1', { by: 'admin-1' });
      const [sql, params] = manager.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/"status"\s*=\s*'cheater'/);
      expect(sql).toMatch(/"nerve"\s*=\s*0/);
      expect(sql).toMatch(/"heartsRemaining"\s*=\s*0/);
      expect(sql).toMatch(/"role"\s*=\s*'watcher'/);
      expect(sql).toMatch(/WHERE "id" = \$1 AND "status" <> 'cheater'/);
      expect(params).toEqual(['e1', null, 'admin-1']);
    });

    it('binds the attempt and who called it into the snapshot', async () => {
      await service.flagCheater('e1', { attemptId: 'a1', by: 'ai' });
      const [, params] = manager.query.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual(['e1', 'a1', 'ai']);
    });

    it('rejects the named attempt, but only this enrolment’s and only one in play', async () => {
      await service.flagCheater('e1', {
        attemptId: 'a1',
        by: 'ai',
        reason: 'Screenshot of a screen.',
      });
      expect(manager.query).toHaveBeenCalledTimes(2);
      const [sql, params] = manager.query.mock.calls[1] as [string, unknown[]];
      expect(sql).toMatch(/UPDATE "game_attempts"/);
      expect(sql).toMatch(/"status" = 'rejected'/);
      expect(sql).toMatch(/"enrolmentId" = \$2/);
      expect(sql).toMatch(/"status" IN \('submitted', 'published'\)/);
      expect(params).toEqual(['a1', 'e1', 'Screenshot of a screen.']);
    });

    it('touches no attempt when none is named', async () => {
      await service.flagCheater('e1', { by: 'admin-1' });
      expect(manager.query).toHaveBeenCalledTimes(1);
    });

    it('tells the person', async () => {
      await service.flagCheater('e1', { by: 'ai' });
      expect(notifications.notify).toHaveBeenCalledWith(
        'u1',
        'system',
        expect.stringMatching(/removed/i),
        expect.stringMatching(/only watch/i),
      );
    });

    it('returns the fresh row', async () => {
      const result = await service.flagCheater('e1', { by: 'ai' });
      expect(result).toEqual({ id: 'e1', status: 'cheater' });
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'e1' } });
    });

    /**
     * A model verdict and a reviewer arriving together must not both "win":
     * the second would overwrite the snapshot with the zeros the first wrote.
     */
    it('refuses an account already marked', async () => {
      manager.query.mockReset().mockResolvedValue([]);
      manager.findOne.mockResolvedValue({ id: 'e1', status: 'cheater' });
      await expect(service.flagCheater('e1', { by: 'ai' })).rejects.toThrow(
        ConflictException,
      );
      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it('is a 404 for an enrolment that is not there', async () => {
      manager.query.mockReset().mockResolvedValue([]);
      manager.findOne.mockResolvedValue(null);
      await expect(service.flagCheater('nope', { by: 'ai' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('does not fail the demotion when the notification does', async () => {
      notifications.notify.mockRejectedValue(new Error('mail is down'));
      await expect(
        service.flagCheater('e1', { by: 'ai' }),
      ).resolves.toBeDefined();
    });

    /** Everything on zero means the coins too, and the ledger says so. */
    describe('the coins', () => {
      it('zeroes them and keeps what was there in the snapshot', async () => {
        await service.flagCheater('e1', { by: 'ai' });
        const [sql] = manager.query.mock.calls[0] as [string];
        expect(sql).toMatch(/"coins"\s*=\s*0/);
        expect(sql).toMatch(/'coins', "coins"/);
        expect(sql).toMatch(/AS "coinsBefore"/);
      });

      it('writes the zeroing to the ledger when there were any', async () => {
        manager.query
          .mockReset()
          .mockResolvedValueOnce([{ id: 'e1', userId: 'u1', coinsBefore: 4 }])
          .mockResolvedValue([]);
        await service.flagCheater('e1', { attemptId: 'a1', by: 'ai' });
        const [sql, params] = manager.query.mock.calls[1] as [
          string,
          unknown[],
        ];
        expect(sql).toMatch(/INSERT INTO "game_coin_ledger"/);
        expect(sql).toMatch(/'cheating'/);
        expect(params).toEqual(['e1', -4, 'a1']);
        // The attempt rejection still follows.
        const [third] = manager.query.mock.calls[2] as [string];
        expect(third).toMatch(/UPDATE "game_attempts"/);
      });

      it('writes nothing to the ledger for an empty balance', async () => {
        manager.query
          .mockReset()
          .mockResolvedValueOnce([{ id: 'e1', userId: 'u1', coinsBefore: 0 }])
          .mockResolvedValue([]);
        await service.flagCheater('e1', { by: 'ai' });
        expect(manager.query).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('reinstate', () => {
    /** The UPDATE ... RETURNING row: what was there, and what is there now. */
    function restored(
      overrides: Partial<{
        coinsBefore: number;
        coins: number;
        nerveBefore: number;
        nerve: number;
      }> = {},
    ) {
      return {
        id: 'e1',
        userId: 'u1',
        coinsBefore: 7,
        coins: 7,
        nerveBefore: 40,
        nerve: 40,
        ...overrides,
      };
    }

    beforeEach(() => {
      manager.query.mockResolvedValue([restored()]);
      repo.findOne.mockResolvedValue({ id: 'e1', status: 'active' });
    });

    it('restores from the snapshot by default', async () => {
      await service.reinstate('e1', { by: 'admin-1' });
      const [sql, params] = manager.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/"status"\s*=\s*'active'/);
      expect(sql).toMatch(/"role"\s*=\s*'player'/);
      expect(sql).toMatch(/"demotionSnapshot"->>'nerve'/);
      expect(sql).toMatch(
        /WHERE e."id" = before."id" AND e."status" <> 'active'/,
      );
      expect(params).toEqual(['e1', true]);
    });

    it('keeps the current numbers when told not to restore', async () => {
      await service.reinstate('e1', { by: 'admin-1', restore: false });
      const [, params] = manager.query.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual(['e1', false]);
    });

    /** Locked and read before it is written, so the deltas are real. */
    it('reads the row before it changes it, under a lock', async () => {
      await service.reinstate('e1', { by: 'admin-1' });
      const [sql] = manager.query.mock.calls[0] as [string];
      expect(sql).toMatch(/WITH before AS \([\s\S]*FOR UPDATE/);
      expect(sql).toMatch(
        /"coins"\s*=\s*CASE WHEN \$2 AND e."demotionSnapshot" \? 'coins'/,
      );
      expect(sql).toMatch(/before."coins" AS "coinsBefore", e."coins"/);
      expect(sql).toMatch(/before."nerve" AS "nerveBefore", e."nerve"/);
    });

    /** What came back is written down like what went — in both ledgers. */
    it('writes the restored coins and Nerve to their ledgers', async () => {
      manager.query
        .mockResolvedValueOnce([
          restored({ coinsBefore: 0, coins: 7, nerveBefore: 0, nerve: 40 }),
        ])
        .mockResolvedValue([]);
      await service.reinstate('e1', { by: 'admin-1' });
      expect(manager.query).toHaveBeenCalledTimes(3);
      const [coinSql, coinParams] = manager.query.mock.calls[1] as [
        string,
        unknown[],
      ];
      expect(coinSql).toMatch(/INSERT INTO "game_coin_ledger"/);
      expect(coinSql).toMatch(/'reinstated'/);
      expect(coinParams).toEqual(['e1', 7, 7]);
      const [scoreSql, scoreParams] = manager.query.mock.calls[2] as [
        string,
        unknown[],
      ];
      expect(scoreSql).toMatch(/INSERT INTO "game_score_ledger"/);
      expect(scoreSql).toMatch(/'reinstated'/);
      expect(scoreParams).toEqual(['e1', 40, 40, 'admin-1']);
    });

    /**
     * A player demoted for hearts kept their coins and Nerve. Putting them
     * back moves nothing, so nothing is written — the old code wrote a
     * +coins row here, which made the ledger sum exceed the balance.
     */
    it('writes no ledger row when nothing came back', async () => {
      manager.query.mockResolvedValue([restored()]);
      await service.reinstate('e1', { by: 'admin-1' });
      expect(manager.query).toHaveBeenCalledTimes(1);
    });

    it('tells the person and returns the fresh row', async () => {
      const result = await service.reinstate('e1', { by: 'admin-1' });
      expect(notifications.notify).toHaveBeenCalledWith(
        'u1',
        'system',
        expect.stringMatching(/back/i),
        expect.any(String),
      );
      expect(result).toEqual({ id: 'e1', status: 'active' });
    });

    it('refuses an account that is already an active player', async () => {
      manager.query.mockResolvedValue([]);
      manager.findOne.mockResolvedValue({ id: 'e1', status: 'active' });
      await expect(service.reinstate('e1', { by: 'admin-1' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('is a 404 for an enrolment that is not there', async () => {
      manager.query.mockResolvedValue([]);
      manager.findOne.mockResolvedValue(null);
      await expect(
        service.reinstate('nope', { by: 'admin-1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('sweepDailyMinimum', () => {
    const NOW = new Date('2026-09-11T20:05:00.000Z');

    /** The SELECT that asks Postgres where yesterday was, then the UPDATE. */
    function windowThen(update: unknown[]) {
      repo.query.mockReset();
      repo.query.mockResolvedValueOnce([WINDOW]).mockResolvedValueOnce(update);
    }

    it('does nothing between seasons', async () => {
      seasons.current.mockResolvedValue(null);
      const report = await service.sweepDailyMinimum(NOW);
      expect(report).toEqual({
        seasonId: null,
        window: null,
        demoted: [],
        skipped: 'no_season',
      });
      expect(repo.query).not.toHaveBeenCalled();
    });

    it('does nothing while the season is only open for enrolment', async () => {
      seasons.current.mockResolvedValue(season({ status: 'open' }));
      windowThen([]);
      const report = await service.sweepDailyMinimum(NOW);
      expect(report.skipped).toBe('not_running');
      expect(report.window).toEqual(WINDOW);
      expect(repo.query).toHaveBeenCalledTimes(1);
    });

    /** A season that started at noon has not given anyone a whole day yet. */
    it('does nothing for a day the season was not running all of', async () => {
      seasons.current.mockResolvedValue(
        season({ startsAt: new Date('2026-09-11T08:00:00.000Z') }),
      );
      windowThen([]);
      const report = await service.sweepDailyMinimum(NOW);
      expect(report.skipped).toBe('not_running');
    });

    it('does nothing for a season with no start on record', async () => {
      seasons.current.mockResolvedValue(season({ startsAt: null }));
      windowThen([]);
      expect((await service.sweepDailyMinimum(NOW)).skipped).toBe(
        'not_running',
      );
    });

    it('asks Postgres for yesterday in Tbilisi', async () => {
      windowThen([]);
      await service.sweepDailyMinimum(NOW);
      const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/AT TIME ZONE/);
      expect(sql).toMatch(/interval '1 day'/);
      expect(params).toEqual([NOW.toISOString(), 'Asia/Tbilisi']);
    });

    it('demotes in one statement with the count and the cut-off inside it', async () => {
      windowThen([{ id: 'e1', userId: 'u1' }]);
      const report = await service.sweepDailyMinimum(NOW);

      const [sql, params] = repo.query.mock.calls[1] as [string, unknown[]];
      expect(sql).toMatch(/'missed_daily_minimum'/);
      expect(sql).toMatch(/"createdAt" </);
      expect(sql).toMatch(/count\(\*\)/);
      expect(sql).toMatch(/"status" IN \('submitted', 'published'\)/);
      expect(sql).toMatch(/"role" = 'player'/);
      expect(sql).toMatch(/"status" = 'active'/);
      expect(params).toEqual(['s1', WINDOW.start, WINDOW.end, 4]);
      expect(report).toEqual({
        seasonId: 's1',
        window: WINDOW,
        demoted: [
          { enrolmentId: 'e1', userId: 'u1', reason: 'missed_daily_minimum' },
        ],
      });
    });

    it('tells every demoted player, naming the number', async () => {
      windowThen([
        { id: 'e1', userId: 'u1' },
        { id: 'e2', userId: 'u2' },
      ]);
      await service.sweepDailyMinimum(NOW);
      expect(notifications.notify).toHaveBeenCalledTimes(2);
      expect(notifications.notify).toHaveBeenCalledWith(
        'u2',
        'system',
        expect.any(String),
        expect.stringMatching(/fewer than 4/),
      );
    });

    it('honours GAME_DAILY_MINIMUM_TASKS', async () => {
      config.get.mockImplementation((key: string) =>
        key === 'GAME_DAILY_MINIMUM_TASKS' ? '6' : undefined,
      );
      windowThen([]);
      await service.sweepDailyMinimum(NOW);
      const [, params] = repo.query.mock.calls[1] as [string, unknown[]];
      expect(params[3]).toBe(6);
    });

    it('does not fail the sweep when a notification does', async () => {
      windowThen([{ id: 'e1', userId: 'u1' }]);
      notifications.notify.mockRejectedValue(new Error('down'));
      const report = await service.sweepDailyMinimum(NOW);
      expect(report.demoted).toHaveLength(1);
    });
  });

  describe('sweepZeroBalance', () => {
    it('does nothing between seasons', async () => {
      seasons.current.mockResolvedValue(null);
      const report = await service.sweepZeroBalance();
      expect(report.skipped).toBe('no_season');
      expect(repo.query).not.toHaveBeenCalled();
    });

    it('moves only active players on zero of everything', async () => {
      repo.query.mockResolvedValue([{ id: 'e3', userId: 'u3' }]);
      const report = await service.sweepZeroBalance();
      const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/"nerve" = 0/);
      expect(sql).toMatch(/"heartsRemaining" = 0/);
      // Zero of everything includes the coins now that there are coins.
      expect(sql).toMatch(/"coins" = 0/);
      expect(sql).toMatch(/"role" = 'player'/);
      expect(sql).toMatch(/"status" = 'active'/);
      expect(sql).toMatch(/'zero_balance'/);
      expect(params).toEqual(['s1']);
      expect(report.demoted).toEqual([
        { enrolmentId: 'e3', userId: 'u3', reason: 'zero_balance' },
      ]);
    });

    it('tells the person', async () => {
      repo.query.mockResolvedValue([{ id: 'e3', userId: 'u3' }]);
      await service.sweepZeroBalance();
      expect(notifications.notify).toHaveBeenCalledWith(
        'u3',
        'system',
        expect.any(String),
        expect.stringMatching(/zero Nerve/),
      );
    });
  });

  describe('runSweeps', () => {
    it('runs the daily minimum first, then zero balance', async () => {
      const order: string[] = [];
      jest.spyOn(service, 'sweepDailyMinimum').mockImplementation(() => {
        order.push('daily');
        return Promise.resolve({ seasonId: 's1', window: WINDOW, demoted: [] });
      });
      jest.spyOn(service, 'sweepZeroBalance').mockImplementation(() => {
        order.push('zero');
        return Promise.resolve({ seasonId: 's1', window: null, demoted: [] });
      });
      const report = await service.runSweeps();
      expect(order).toEqual(['daily', 'zero']);
      expect(report.dailyMinimum.window).toEqual(WINDOW);
      expect(report.zeroBalance.window).toBeNull();
    });
  });

  /**
   * Every `@Cron` fires on every instance. The lock is what keeps two
   * processes from each moving the same people and each notifying them.
   */
  /**
   * Hearts. Three to start, one gone per decline or per clock that reaches
   * zero, and the last one makes them a watcher on the spot — whichever
   * caller burned it.
   */
  describe('hearts', () => {
    describe('burnHearts', () => {
      it('does nothing for nobody', async () => {
        await expect(service.burnHearts([], 'declined')).resolves.toEqual([]);
        expect(repo.query).not.toHaveBeenCalled();
      });

      it('burns one in a statement that never goes below zero', async () => {
        repo.query.mockResolvedValueOnce([
          { id: 'e1', userId: 'u1', heartsRemaining: 2 },
        ]);
        await service.burnHearts(['e1', 'e1'], 'declined');
        const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
        expect(sql).toContain('GREATEST("heartsRemaining" - 1, 0)');
        expect(sql).toContain('= ANY($1::uuid[])');
        expect(sql).toMatch(/"role" = 'player'/);
        // De-duplicated: a double tap must not cost two hearts.
        expect(params).toEqual([['e1']]);
      });

      it('reports what each enrolment has left', async () => {
        repo.query.mockResolvedValueOnce([
          { id: 'e1', userId: 'u1', heartsRemaining: 2 },
          { id: 'e2', userId: 'u2', heartsRemaining: 1 },
        ]);
        await expect(
          service.burnHearts(['e1', 'e2'], 'expired'),
        ).resolves.toEqual([
          {
            enrolmentId: 'e1',
            userId: 'u1',
            heartsRemaining: 2,
            demoted: false,
          },
          {
            enrolmentId: 'e2',
            userId: 'u2',
            heartsRemaining: 1,
            demoted: false,
          },
        ]);
      });

      it('demotes the one whose last heart just went', async () => {
        repo.query
          .mockResolvedValueOnce([
            { id: 'e1', userId: 'u1', heartsRemaining: 0 },
            { id: 'e2', userId: 'u2', heartsRemaining: 2 },
          ])
          .mockResolvedValueOnce([{ id: 'e1', userId: 'u1' }]);
        const result = await service.burnHearts(['e1', 'e2'], 'expired');

        expect(repo.query).toHaveBeenCalledTimes(2);
        const [sql, params] = repo.query.mock.calls[1] as [string, unknown[]];
        expect(sql).toContain("'out_of_hearts'");
        expect(sql).toMatch(/"heartsRemaining" <= 0/);
        expect(params).toEqual([['e1']]);
        expect(result).toEqual([
          {
            enrolmentId: 'e1',
            userId: 'u1',
            heartsRemaining: 0,
            demoted: true,
          },
          {
            enrolmentId: 'e2',
            userId: 'u2',
            heartsRemaining: 2,
            demoted: false,
          },
        ]);
      });

      it('runs no demotion when nobody reached zero', async () => {
        repo.query.mockResolvedValueOnce([
          { id: 'e1', userId: 'u1', heartsRemaining: 1 },
        ]);
        await service.burnHearts(['e1'], 'declined');
        expect(repo.query).toHaveBeenCalledTimes(1);
      });

      it('says a decline cost it', async () => {
        repo.query.mockResolvedValueOnce([
          { id: 'e1', userId: 'u1', heartsRemaining: 2 },
        ]);
        await service.burnHearts(['e1'], 'declined');
        expect(notifications.notify).toHaveBeenCalledWith(
          'u1',
          'system',
          'You lost a heart',
          expect.stringMatching(/Declining.*2 left/),
        );
      });

      it('says the clock cost it', async () => {
        repo.query.mockResolvedValueOnce([
          { id: 'e1', userId: 'u1', heartsRemaining: 1 },
        ]);
        await service.burnHearts(['e1'], 'expired');
        expect(notifications.notify).toHaveBeenCalledWith(
          'u1',
          'system',
          'You lost a heart',
          expect.stringMatching(/clock ran out.*1 left/),
        );
      });

      it('tells the demoted one they are a watcher, not that they lost a heart', async () => {
        repo.query
          .mockResolvedValueOnce([
            { id: 'e1', userId: 'u1', heartsRemaining: 0 },
          ])
          .mockResolvedValueOnce([{ id: 'e1', userId: 'u1' }]);
        await service.burnHearts(['e1'], 'expired');
        expect(notifications.notify).toHaveBeenCalledTimes(1);
        expect(notifications.notify).toHaveBeenCalledWith(
          'u1',
          'system',
          'You are a watcher now',
          expect.stringMatching(/last heart/),
        );
      });
    });

    describe('demoteOutOfHearts', () => {
      it('does nothing for nobody', async () => {
        await expect(service.demoteOutOfHearts([])).resolves.toEqual([]);
        expect(repo.query).not.toHaveBeenCalled();
      });

      it('only moves an active player who actually has none left', async () => {
        repo.query.mockResolvedValueOnce([]);
        await service.demoteOutOfHearts(['e1', 'e1']);
        const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
        expect(sql).toMatch(/"role" = 'player'/);
        expect(sql).toMatch(/"status" = 'active'/);
        expect(sql).toMatch(/"heartsRemaining" <= 0/);
        expect(sql).toMatch(/"demotionReason"\s*=\s*'out_of_hearts'/);
        expect(sql).toMatch(/"role"\s*=\s*'watcher'/);
        expect(params).toEqual([['e1']]);
      });

      it('returns who moved, with the reason, and tells them', async () => {
        repo.query.mockResolvedValueOnce([{ id: 'e1', userId: 'u1' }]);
        await expect(service.demoteOutOfHearts(['e1'])).resolves.toEqual([
          { enrolmentId: 'e1', userId: 'u1', reason: 'out_of_hearts' },
        ]);
        expect(notifications.notify).toHaveBeenCalledWith(
          'u1',
          'system',
          'You are a watcher now',
          expect.stringMatching(/last heart/),
        );
      });

      it('survives a notification that fails', async () => {
        repo.query.mockResolvedValueOnce([{ id: 'e1', userId: 'u1' }]);
        notifications.notify.mockRejectedValue(new Error('mail down'));
        await expect(service.demoteOutOfHearts(['e1'])).resolves.toHaveLength(
          1,
        );
      });
    });
  });

  describe('the nightly crons', () => {
    it('take the leader lock under their own names', async () => {
      seasons.current.mockResolvedValue(null);
      await service.nightlyDailyMinimum();
      await service.nightlyZeroBalance();
      expect(leaderLock.withLock).toHaveBeenCalledWith(
        'gameDailyMinimum',
        expect.any(Number),
        expect.any(Function),
      );
      expect(leaderLock.withLock).toHaveBeenCalledWith(
        'gameZeroBalance',
        expect.any(Number),
        expect.any(Function),
      );
    });

    it('run the sweep inside the lock', async () => {
      seasons.current.mockResolvedValue(null);
      const spy = jest.spyOn(service, 'sweepZeroBalance');
      await service.nightlyZeroBalance();
      expect(spy).toHaveBeenCalled();
    });

    it('log a failure rather than letting it reach the scheduler', async () => {
      seasons.current.mockRejectedValue(new Error('database gone'));
      await expect(service.nightlyDailyMinimum()).resolves.toBeUndefined();
      await expect(service.nightlyZeroBalance()).resolves.toBeUndefined();
    });
  });
});
