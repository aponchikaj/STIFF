import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ClansService } from './clans.service';
import { DisciplineService } from './discipline.service';
import { EconomyService } from './economy.service';
import {
  GameAttempt,
  type VotingResolution,
} from './entities/game-attempt.entity';
import { VerdictsService } from './verdicts.service';

/**
 * The verdict.
 *
 * It is the only thing that puts an attempt into the feed *and* the only
 * thing that pays a task — and, since the watchers' vote, the only thing
 * that pays the voters. The score is what ranks the season, so paying it
 * twice is not a cosmetic bug: the transition is claimed rather than
 * read-then-written, and every payment goes through the ledger inside the
 * same transaction.
 */

/** An assignment with its template, as `settle` loads it. */
function withTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'as1',
    clanId: null,
    taskTemplate: { rewardNerve: 10, rewardCoins: 3, penaltyCoins: 2 },
    ...overrides,
  };
}

function attempt(overrides: Partial<GameAttempt> = {}): GameAttempt {
  return {
    id: 'a1',
    enrolmentId: 'e1',
    status: 'submitted',
    day: 1,
    votingStatus: 'none',
    ...overrides,
  } as GameAttempt;
}

describe('VerdictsService', () => {
  let service: VerdictsService;
  let attemptRepo: Record<string, jest.Mock>;
  let discipline: { demoteOutOfHearts: jest.Mock };
  let economy: { move: jest.Mock; announce: jest.Mock };
  let clans: { memberEnrolmentIds: jest.Mock };
  let claim: jest.Mock;
  /** What `settle` loads the assignment through, inside the transaction. */
  let managerFindOne: jest.Mock;
  let manager: { query: jest.Mock; findOne: jest.Mock };

  beforeEach(async () => {
    attemptRepo = {
      findOne: jest.fn().mockResolvedValue(attempt()),
      query: jest.fn().mockResolvedValue([[{ id: 'a1' }], 1]),
    };
    discipline = { demoteOutOfHearts: jest.fn().mockResolvedValue([]) };
    economy = {
      move: jest.fn().mockResolvedValue([]),
      announce: jest.fn().mockResolvedValue(undefined),
    };
    clans = { memberEnrolmentIds: jest.fn().mockResolvedValue(['e1', 'e2']) };
    // Matched the transition; this caller owns it.
    claim = jest.fn().mockResolvedValue([[{ id: 'a1' }], 1]);
    managerFindOne = jest.fn().mockResolvedValue(null);
    manager = { query: claim, findOne: managerFindOne };

    const dataSource = {
      transaction: jest.fn(
        async (cb: (m: unknown) => Promise<unknown>) => await cb(manager),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerdictsService,
        { provide: getRepositoryToken(GameAttempt), useValue: attemptRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: DisciplineService, useValue: discipline },
        { provide: EconomyService, useValue: economy },
        { provide: ClansService, useValue: clans },
      ],
    }).compile();

    service = module.get(VerdictsService);
  });

  describe('settle', () => {
    it('publishes an approved attempt', async () => {
      await service.settle('a1', { verdict: 'approve', nerve: 25 });
      expect(claim).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE "game_attempts"'),
        ['a1', 'published', null],
      );
    });

    it('rejects without publishing', async () => {
      await service.settle('a1', { verdict: 'reject' });
      expect(claim).toHaveBeenCalledWith(expect.anything(), [
        'a1',
        'rejected',
        null,
      ]);
    });

    /** The reason is kept on the row, so the player can be told why. */
    it('writes the trimmed reason on a rejection', async () => {
      await service.settle('a1', {
        verdict: 'reject',
        reason: '  filmed indoors, task said outside  ',
      });
      expect(claim).toHaveBeenCalledWith(expect.anything(), [
        'a1',
        'rejected',
        'filmed indoors, task said outside',
      ]);
    });

    it('never stores a reason on an approval', async () => {
      await service.settle('a1', { verdict: 'approve', reason: 'nice one' });
      expect(claim).toHaveBeenCalledWith(expect.anything(), [
        'a1',
        'published',
        null,
      ]);
    });

    /**
     * Nothing writes a score directly any more: every point and every coin
     * goes through the ledger, inside the transaction that claimed the
     * verdict, so the payment and the publication cannot come apart.
     */
    it('pays the reviewer’s Nerve through the ledger, in the transaction', async () => {
      await service.settle('a1', { verdict: 'approve', nerve: 25 });
      expect(economy.move).toHaveBeenCalledWith(
        ['e1'],
        {
          coins: 0,
          nerve: 25,
          reason: 'task_reward',
          refType: 'attempt',
          refId: 'a1',
        },
        manager,
      );
      const direct = claim.mock.calls.some(([sql]: [string]) =>
        sql.includes('"nerve"'),
      );
      expect(direct).toBe(false);
    });

    it('pays nothing on a rejection, whatever was sent', async () => {
      await service.settle('a1', { verdict: 'reject', nerve: 999 });
      expect(economy.move).not.toHaveBeenCalled();
    });

    it('never pays a negative award', async () => {
      await service.settle('a1', { verdict: 'approve', nerve: -50 });
      expect(economy.move).toHaveBeenCalledWith(
        ['e1'],
        expect.objectContaining({ nerve: 0, coins: 0 }),
        manager,
      );
    });

    describe('what the task pays', () => {
      beforeEach(() => {
        attemptRepo.findOne.mockResolvedValue(attempt({ assignmentId: 'as1' }));
        managerFindOne.mockResolvedValue(withTask());
        economy.move.mockResolvedValue([
          {
            enrolmentId: 'e1',
            userId: 'u1',
            coinsDelta: 3,
            coinsAfter: 3,
            nerveDelta: 10,
            nerveAfter: 10,
          },
        ]);
      });

      it('loads the assignment and its task inside the transaction', async () => {
        await service.settle('a1', { verdict: 'approve' });
        expect(managerFindOne).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            where: { id: 'as1' },
            relations: { taskTemplate: true },
          }),
        );
      });

      /** A solo task pays its holder the template's reward and coins. */
      it('pays the template’s Nerve and coins to the holder of a solo task', async () => {
        await service.settle('a1', { verdict: 'approve' });
        expect(economy.move).toHaveBeenCalledWith(
          ['e1'],
          {
            coins: 3,
            nerve: 10,
            reason: 'task_reward',
            refType: 'attempt',
            refId: 'a1',
          },
          manager,
        );
        expect(clans.memberEnrolmentIds).not.toHaveBeenCalled();
      });

      it('lets the reviewer’s Nerve override the template on a solo task', async () => {
        await service.settle('a1', { verdict: 'approve', nerve: 40 });
        expect(economy.move).toHaveBeenCalledWith(
          ['e1'],
          expect.objectContaining({ nerve: 40, coins: 3 }),
          manager,
        );
      });

      it('tells the person what they earned', async () => {
        await service.settle('a1', { verdict: 'approve' });
        expect(economy.announce).toHaveBeenCalledWith(
          expect.any(Array),
          'Task approved',
          expect.any(Function),
        );
      });

      /** A rejected solo task costs nothing; the penalty is a clan's rule. */
      it('charges nothing for a rejected solo task', async () => {
        await service.settle('a1', { verdict: 'reject' });
        expect(economy.move).not.toHaveBeenCalled();
      });

      /** An attempt with no assignment on record still pays the reviewer. */
      it('pays the reviewer’s Nerve to the holder when there is no assignment', async () => {
        attemptRepo.findOne.mockResolvedValue(attempt());
        await service.settle('a1', { verdict: 'approve', nerve: 15 });
        expect(managerFindOne).not.toHaveBeenCalled();
        expect(economy.move).toHaveBeenCalledWith(
          ['e1'],
          expect.objectContaining({ nerve: 15, coins: 0 }),
          manager,
        );
      });

      describe('for a clan', () => {
        beforeEach(() => {
          managerFindOne.mockResolvedValue(withTask({ clanId: 'c1' }));
        });

        /** Both did it, so both are paid — the template's reward, not the reviewer's. */
        it('pays both members the template’s reward', async () => {
          await service.settle('a1', { verdict: 'approve', nerve: 99 });
          expect(clans.memberEnrolmentIds).toHaveBeenCalledWith('c1');
          expect(economy.move).toHaveBeenCalledWith(
            ['e1', 'e2'],
            {
              coins: 3,
              nerve: 10,
              reason: 'task_reward',
              refType: 'attempt',
              refId: 'a1',
            },
            manager,
          );
          expect(economy.announce).toHaveBeenCalledWith(
            expect.any(Array),
            'Your clan finished a task',
            expect.any(Function),
          );
        });

        /** Failing costs each member the template's penalty, one to three. */
        it('charges both members the penalty on a rejection', async () => {
          await service.settle('a1', { verdict: 'reject' });
          expect(economy.move).toHaveBeenCalledWith(
            ['e1', 'e2'],
            {
              coins: -2,
              reason: 'task_penalty',
              refType: 'attempt',
              refId: 'a1',
            },
            manager,
          );
          expect(economy.announce).toHaveBeenCalledWith(
            expect.any(Array),
            'Your clan failed a task',
            expect.any(Function),
          );
        });

        it.each([
          [5, -3],
          [0, -1],
        ])('clamps a template penalty of %s to %s', async (raw, coins) => {
          managerFindOne.mockResolvedValue(
            withTask({
              clanId: 'c1',
              taskTemplate: {
                rewardNerve: 0,
                rewardCoins: 0,
                penaltyCoins: raw,
              },
            }),
          );
          await service.settle('a1', { verdict: 'reject' });
          expect(economy.move).toHaveBeenCalledWith(
            ['e1', 'e2'],
            expect.objectContaining({ coins }),
            manager,
          );
        });
      });
    });

    /**
     * The reason the transition is claimed. Two reviewers opening the same
     * item would otherwise both settle it and both pay its Nerve.
     */
    it('refuses when someone else already settled it', async () => {
      claim.mockResolvedValue([[], 0]);
      await expect(
        service.settle('a1', { verdict: 'approve', nerve: 25 }),
      ).rejects.toThrow(ConflictException);
    });

    it('pays nothing at all when it loses that race', async () => {
      claim.mockResolvedValue([[], 0]);
      await expect(
        service.settle('a1', { verdict: 'approve', nerve: 25 }),
      ).rejects.toThrow();
      expect(claim).toHaveBeenCalledTimes(1);
      expect(managerFindOne).not.toHaveBeenCalled();
      expect(economy.move).not.toHaveBeenCalled();
    });

    /** Ash never returns, so the floor is in the statement. */
    it('burns a heart without going below zero', async () => {
      await service.settle('a1', { verdict: 'reject', burnHeart: true });
      expect(claim).toHaveBeenCalledWith(
        expect.stringContaining('GREATEST("heartsRemaining" - 1, 0)'),
        ['e1'],
      );
    });

    it('leaves hearts alone unless asked', async () => {
      await service.settle('a1', { verdict: 'reject' });
      const burnt = claim.mock.calls.some(([sql]: [string]) =>
        sql.includes('heartsRemaining'),
      );
      expect(burnt).toBe(false);
    });

    /**
     * A burned last heart ends the season for them whoever burned it — the
     * demotion is asked for after the transaction commits, never on a
     * verdict that lost the race.
     */
    it('asks whether the burned heart was the last one', async () => {
      await service.settle('a1', { verdict: 'reject', burnHeart: true });
      expect(discipline.demoteOutOfHearts).toHaveBeenCalledWith(['e1']);
      const burnOrder = claim.mock.invocationCallOrder[0];
      const demoteOrder =
        discipline.demoteOutOfHearts.mock.invocationCallOrder[0];
      expect(demoteOrder).toBeGreaterThan(burnOrder);
    });

    it('does not ask when no heart was burned', async () => {
      await service.settle('a1', { verdict: 'reject' });
      expect(discipline.demoteOutOfHearts).not.toHaveBeenCalled();
    });

    it('does not ask when it lost the race', async () => {
      claim.mockResolvedValue([[], 0]);
      await expect(
        service.settle('a1', { verdict: 'reject', burnHeart: true }),
      ).rejects.toThrow(ConflictException);
      expect(discipline.demoteOutOfHearts).not.toHaveBeenCalled();
    });

    it('is a 404 for an attempt that is not there', async () => {
      attemptRepo.findOne.mockResolvedValue(null);
      await expect(
        service.settle('a1', { verdict: 'approve' }),
      ).rejects.toThrow(NotFoundException);
    });

    /** Nothing was uploaded, so there is nothing to have a verdict about. */
    it('refuses to settle a day nobody handed in', async () => {
      attemptRepo.findOne.mockResolvedValue(
        attempt({ status: 'awaiting_upload' }),
      );
      await expect(
        service.settle('a1', { verdict: 'approve' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /**
   * The watchers' vote closes with the verdict. A "yes" on an approved
   * hand-in pays, once, outside the voter's cooldown; everything else is
   * counted and written down.
   */
  describe('voting', () => {
    /** Answers each statement by what it is, rather than by call order. */
    function dispatch(
      overrides: {
        tallies?: { vote: 'yes' | 'no'; count: number }[];
        winners?: { enrolmentId: string }[];
      } = {},
    ) {
      const tallies = overrides.tallies ?? [
        { vote: 'yes', count: 3 },
        { vote: 'no', count: 1 },
      ];
      const winners = overrides.winners ?? [
        { enrolmentId: 'w1' },
        { enrolmentId: 'w2' },
      ];
      claim.mockImplementation((sql: string) => {
        if (sql.includes('GROUP BY "vote"')) return Promise.resolve(tallies);
        if (sql.includes("'vote_reward'")) return Promise.resolve(winners);
        if (sql.includes(`"votingStatus" = 'resolved'`)) {
          return Promise.resolve([[], 0]);
        }
        return Promise.resolve([[{ id: 'a1' }], 1]);
      });
    }

    type Call = [string, unknown[]];
    const calls = (): Call[] => claim.mock.calls as Call[];
    const talliesCall = (): Call | undefined =>
      calls().find(([sql]) => sql.includes('GROUP BY "vote"'));
    const payoutCall = (): Call | undefined =>
      calls().find(([sql]) => sql.includes("'vote_reward'"));
    const resolutionWritten = (): VotingResolution => {
      const call = claim.mock.calls.find(([sql]: [string]) =>
        sql.includes(`"votingStatus" = 'resolved'`),
      ) as [string, [string, string]] | undefined;
      if (!call) throw new Error('no resolution was written');
      return JSON.parse(call[1][1]) as VotingResolution;
    };

    it('leaves an attempt with no vote alone', async () => {
      attemptRepo.findOne.mockResolvedValue(attempt({ votingStatus: 'none' }));
      await service.settle('a1', { verdict: 'approve' });
      expect(talliesCall()).toBeUndefined();
      expect(payoutCall()).toBeUndefined();
      const written = claim.mock.calls.some(([sql]: [string]) =>
        sql.includes('"votingStatus"'),
      );
      expect(written).toBe(false);
    });

    it('leaves a vote already resolved alone', async () => {
      attemptRepo.findOne.mockResolvedValue(
        attempt({ votingStatus: 'resolved' }),
      );
      await service.settle('a1', { verdict: 'approve' });
      expect(talliesCall()).toBeUndefined();
    });

    describe('an open vote, approved', () => {
      beforeEach(() => {
        attemptRepo.findOne.mockResolvedValue(
          attempt({ votingStatus: 'open', day: 2 }),
        );
        dispatch();
      });

      it('tallies the votes first', async () => {
        await service.settle('a1', { verdict: 'approve' });
        expect(talliesCall()?.[1]).toEqual(['a1']);
      });

      /**
       * One statement pays everyone eligible: the cooldown, the "paid once"
       * mark, the coins and the ledger row all live in it, so two settlers
       * racing cannot pay a voter twice.
       */
      it('pays every eligible yes-voter in one statement', async () => {
        await service.settle('a1', { verdict: 'approve' });
        const [sql, params] = payoutCall() as [string, unknown[]];
        expect(sql).toContain('lastVoteWinAt');
        expect(sql).toContain('make_interval(hours => $3)');
        expect(sql).toContain('"paidCoins" = 0');
        expect(sql).toContain('FOR UPDATE OF e');
        expect(sql).toContain("'vote_reward'");
        expect(params).toEqual(['a1', 3, 5]);
      });

      it.each([
        [1, 2],
        [2, 3],
        [3, 5],
      ])(
        'pays the tier default when a person settled day %s: %s coins',
        async (day, payout) => {
          attemptRepo.findOne.mockResolvedValue(
            attempt({ votingStatus: 'open', day: day as 1 | 2 | 3 }),
          );
          await service.settle('a1', { verdict: 'approve' });
          expect((payoutCall() as [string, unknown[]])[1]).toEqual([
            'a1',
            payout,
            5,
          ]);
          expect(resolutionWritten().payout).toBe(payout);
        },
      );

      it('pays the resolver’s figure, clamped into the rule', async () => {
        await service.settle('a1', {
          verdict: 'approve',
          by: 'resolver',
          resolution: {
            outcome: 'confirmed',
            confidence: 0.9,
            payout: 7,
            reasons: ['Clearly done.'],
            model: 'claude-sonnet-5',
          },
        });
        expect((payoutCall() as [string, unknown[]])[1]).toEqual(['a1', 5, 5]);
      });

      it('writes the resolution with who was paid and who was cooling', async () => {
        await service.settle('a1', { verdict: 'approve', by: 'admin-1' });
        const written = resolutionWritten();
        expect(written).toMatchObject({
          outcome: 'confirmed',
          confidence: 1,
          payout: 3,
          model: null,
          by: 'admin-1',
          yes: 3,
          no: 1,
          paid: 2,
          cooling: 1,
        });
        expect(written.reasons).toEqual(['Approved by a reviewer.']);
        expect(Date.parse(written.resolvedAt)).not.toBeNaN();
      });

      it('keeps the resolver’s outcome, reasons and model when it decided', async () => {
        await service.settle('a1', {
          verdict: 'approve',
          by: 'resolver',
          resolution: {
            outcome: 'confirmed',
            confidence: 0.8,
            payout: 4,
            reasons: ['Task visible.', 'Fresh photo.'],
            model: 'claude-sonnet-5',
          },
        });
        expect(resolutionWritten()).toMatchObject({
          outcome: 'confirmed',
          confidence: 0.8,
          payout: 4,
          reasons: ['Task visible.', 'Fresh photo.'],
          model: 'claude-sonnet-5',
          by: 'resolver',
        });
      });

      it('defaults `by` to admin', async () => {
        await service.settle('a1', { verdict: 'approve' });
        expect(resolutionWritten().by).toBe('admin');
      });

      it('pays nobody when nobody said yes', async () => {
        dispatch({ tallies: [{ vote: 'no', count: 4 }] });
        await service.settle('a1', { verdict: 'approve' });
        expect(payoutCall()).toBeUndefined();
        expect(resolutionWritten()).toMatchObject({
          yes: 0,
          no: 4,
          paid: 0,
          cooling: 0,
        });
      });

      it('marks the vote resolved on the attempt', async () => {
        await service.settle('a1', { verdict: 'approve' });
        const call = claim.mock.calls.find(([sql]: [string]) =>
          sql.includes(`"votingStatus" = 'resolved'`),
        ) as [string, unknown[]];
        expect(call[1][0]).toBe('a1');
      });
    });

    /** A "no" verdict pays nobody — a "no" vote never pays, by the rule. */
    it('closes a rejected vote without paying anyone', async () => {
      attemptRepo.findOne.mockResolvedValue(attempt({ votingStatus: 'open' }));
      dispatch();
      await service.settle('a1', { verdict: 'reject', reason: 'not it' });
      expect(payoutCall()).toBeUndefined();
      expect(resolutionWritten()).toMatchObject({
        outcome: 'not_confirmed',
        paid: 0,
        cooling: 0,
        yes: 3,
        no: 1,
      });
      expect(resolutionWritten().reasons).toEqual(['Rejected by a reviewer.']);
    });

    it('pays a vote the resolver deferred once a person approves', async () => {
      attemptRepo.findOne.mockResolvedValue(
        attempt({ votingStatus: 'deferred' }),
      );
      dispatch();
      await service.settle('a1', { verdict: 'approve' });
      expect(payoutCall()).toBeDefined();
      expect(resolutionWritten().paid).toBe(2);
    });

    it('pays a vote claimed by the resolver when it settles', async () => {
      attemptRepo.findOne.mockResolvedValue(
        attempt({ votingStatus: 'resolving' }),
      );
      dispatch();
      await service.settle('a1', { verdict: 'approve', by: 'resolver' });
      expect(payoutCall()).toBeDefined();
    });

    /** The vote is closed after the claim, never on a verdict that lost it. */
    it('does not touch the vote when it loses the claim', async () => {
      attemptRepo.findOne.mockResolvedValue(attempt({ votingStatus: 'open' }));
      claim.mockResolvedValue([[], 0]);
      await expect(
        service.settle('a1', { verdict: 'approve' }),
      ).rejects.toThrow(ConflictException);
      expect(talliesCall()).toBeUndefined();
    });
  });

  describe('unpublish', () => {
    /** The claim, then the SELECT of what the attempt paid — nothing, by default. */
    beforeEach(() => {
      claim.mockReset();
      claim
        .mockResolvedValueOnce([[{ id: 'a1' }], 1])
        .mockResolvedValueOnce([]);
    });

    it('takes it back out of the feed, inside a transaction', async () => {
      await service.unpublish('a1');
      expect(claim).toHaveBeenCalledWith(
        expect.stringContaining(`"status" = 'rejected'`),
        ['a1'],
      );
      expect(attemptRepo.query).not.toHaveBeenCalled();
    });

    it('refuses something that is not in the feed', async () => {
      claim.mockReset();
      claim.mockResolvedValue([[], 0]);
      await expect(service.unpublish('a1')).rejects.toThrow(ConflictException);
      expect(economy.move).not.toHaveBeenCalled();
    });

    /**
     * The clawback is read from the ledger, not from the template: what this
     * attempt actually paid each enrolment, net of anything already taken
     * back, so a second unpublish finds nothing and a clan attempt is taken
     * back from both members.
     */
    it('claws back what the attempt paid, per enrolment, through the ledger', async () => {
      claim.mockReset();
      claim.mockResolvedValueOnce([[{ id: 'a1' }], 1]).mockResolvedValueOnce([
        { enrolmentId: 'e1', net: 25 },
        { enrolmentId: 'e2', net: 25 },
      ]);
      economy.move.mockResolvedValue([
        {
          enrolmentId: 'e1',
          userId: 'u1',
          coinsDelta: 0,
          coinsAfter: 3,
          nerveDelta: -25,
          nerveAfter: 75,
        },
      ]);

      await service.unpublish('a1', { by: 'admin-1' });

      const [sql, params] = claim.mock.calls[1] as [string, unknown[]];
      expect(sql).toMatch(/FROM "game_score_ledger"/);
      expect(sql).toMatch(/"reason" IN \('task_reward', 'clawback'\)/);
      expect(sql).toMatch(/HAVING SUM\("delta"\) > 0/);
      expect(params).toEqual(['a1']);

      expect(economy.move).toHaveBeenCalledTimes(2);
      expect(economy.move).toHaveBeenCalledWith(
        ['e1'],
        {
          coins: 0,
          nerve: -25,
          reason: 'admin',
          scoreReason: 'clawback',
          refType: 'attempt',
          refId: 'a1',
          by: 'admin-1',
        },
        manager,
      );
      expect(economy.announce).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ nerveDelta: -25 })]),
        expect.stringMatching(/taken back/i),
        expect.any(Function),
      );
    });

    /** Coins stay where they are; the rule as written claws back the score. */
    it('never moves coins', async () => {
      claim.mockReset();
      claim
        .mockResolvedValueOnce([[{ id: 'a1' }], 1])
        .mockResolvedValueOnce([{ enrolmentId: 'e1', net: 10 }]);
      await service.unpublish('a1');
      const [, movement] = economy.move.mock.calls[0] as [
        unknown,
        { coins: number },
      ];
      expect(movement.coins).toBe(0);
    });

    it('takes nothing back when nothing was paid, and says nothing', async () => {
      await service.unpublish('a1');
      expect(economy.move).not.toHaveBeenCalled();
      expect(economy.announce).not.toHaveBeenCalled();
    });
  });
});
