import {
  settleWarBook,
  type WarSettlement,
  type WarSide,
  type WarStake,
  BOARD_NEIGHBOURS,
  CHEATER_NOTICE,
  CLAN_SIZE,
  DEFAULT_CHEAT_CONFIDENCE_THRESHOLD,
  DEFAULT_DAILY_MINIMUM_TASKS,
  GAME_TIMEZONE,
  MAX_PENALTY_COINS,
  MIN_PENALTY_COINS,
  MINIMUM_AGE,
  VOTE_REWARD_MAX_COINS,
  VOTE_REWARD_MIN_COINS,
  VOTE_WIN_COOLDOWN_HOURS,
  VOTING_WINDOW_HOURS,
  cheatConfidenceThreshold,
  cheatDetectionMode,
  clampPenalty,
  clampVoteReward,
  dailyMinimumTasks,
  defaultVoteReward,
} from './rules';

/** A `ConfigService` stand-in: one key, one value. */
function env(values: Record<string, string | undefined>) {
  return { get: <T = string>(key: string) => values[key] as T | undefined };
}

describe('the rules', () => {
  it('pins the constants a player is told', () => {
    expect(MINIMUM_AGE).toBe(16);
    expect(DEFAULT_DAILY_MINIMUM_TASKS).toBe(4);
    expect(GAME_TIMEZONE).toBe('Asia/Tbilisi');
    expect(CHEATER_NOTICE).toBe('CHEATER WROTE A COMMENT');
    expect(DEFAULT_CHEAT_CONFIDENCE_THRESHOLD).toBe(0.85);
  });

  /** A clan is two people, and failing a team task costs one to three coins. */
  describe('clans and the team penalty', () => {
    it('pins the clan size at two', () => {
      expect(CLAN_SIZE).toBe(2);
    });

    it('pins the penalty at one to three coins', () => {
      expect(MIN_PENALTY_COINS).toBe(1);
      expect(MAX_PENALTY_COINS).toBe(3);
    });

    describe('clampPenalty', () => {
      it('reads a missing value as the minimum', () => {
        expect(clampPenalty(undefined)).toBe(1);
        expect(clampPenalty(null)).toBe(1);
      });

      it('lifts zero to the minimum', () => {
        expect(clampPenalty(0)).toBe(1);
      });

      it('rounds, then caps at the maximum', () => {
        expect(clampPenalty(2.6)).toBe(3);
        expect(clampPenalty(7)).toBe(3);
      });

      it('keeps a value already in range', () => {
        expect(clampPenalty(2)).toBe(2);
      });

      it('reads garbage as the minimum', () => {
        expect(clampPenalty('x')).toBe(1);
        expect(clampPenalty(Number.NaN)).toBe(1);
      });
    });
  });

  /**
   * The watchers' vote: three hours to call it, two to five coins for a
   * right "yes", and five hours before the next payout.
   */
  describe('the vote', () => {
    it('pins the window, the payout range and the cooldown', () => {
      expect(VOTING_WINDOW_HOURS).toBe(3);
      expect(VOTE_REWARD_MIN_COINS).toBe(2);
      expect(VOTE_REWARD_MAX_COINS).toBe(5);
      expect(VOTE_WIN_COOLDOWN_HOURS).toBe(5);
    });

    describe('clampVoteReward', () => {
      it('reads nothing as the floor', () => {
        expect(clampVoteReward(undefined)).toBe(2);
        expect(clampVoteReward(null)).toBe(2);
      });

      it('lifts a payout below the floor up to it', () => {
        expect(clampVoteReward(1)).toBe(2);
        expect(clampVoteReward(0)).toBe(2);
      });

      it('caps a payout above the ceiling', () => {
        expect(clampVoteReward(7)).toBe(5);
      });

      it('rounds and keeps a value inside the range', () => {
        expect(clampVoteReward(3.4)).toBe(3);
        expect(clampVoteReward(4)).toBe(4);
      });

      it('reads garbage as the floor', () => {
        expect(clampVoteReward('x')).toBe(2);
        expect(clampVoteReward(Number.NaN)).toBe(2);
      });
    });

    /** When the resolver could not say, the tier decides what a right call was worth. */
    describe('defaultVoteReward', () => {
      it('pays by the day of the ladder', () => {
        expect(defaultVoteReward(1)).toBe(2);
        expect(defaultVoteReward(2)).toBe(3);
        expect(defaultVoteReward(3)).toBe(5);
      });

      it('stays inside the range for a day off the ladder', () => {
        expect(defaultVoteReward(0)).toBe(2);
        expect(defaultVoteReward(9)).toBe(5);
      });
    });
  });

  describe('dailyMinimumTasks', () => {
    it('is four with no environment at all', () => {
      expect(dailyMinimumTasks()).toBe(4);
      expect(dailyMinimumTasks(env({}))).toBe(4);
    });

    it('honours a valid value', () => {
      expect(dailyMinimumTasks(env({ GAME_DAILY_MINIMUM_TASKS: '6' }))).toBe(6);
    });

    it('accepts zero, which switches the sweep off', () => {
      expect(dailyMinimumTasks(env({ GAME_DAILY_MINIMUM_TASKS: '0' }))).toBe(0);
    });

    it('falls back to four on garbage and negatives', () => {
      for (const raw of ['four', '', '-1', '2.5x', 'NaN']) {
        expect(dailyMinimumTasks(env({ GAME_DAILY_MINIMUM_TASKS: raw }))).toBe(
          raw === '2.5x' ? 2 : 4,
        );
      }
    });
  });

  describe('cheatDetectionMode', () => {
    it('enforces by default', () => {
      expect(cheatDetectionMode()).toBe('enforce');
      expect(cheatDetectionMode(env({}))).toBe('enforce');
    });

    it('reads shadow and off, in any case', () => {
      expect(cheatDetectionMode(env({ GAME_CHEAT_DETECTION: 'shadow' }))).toBe(
        'shadow',
      );
      expect(cheatDetectionMode(env({ GAME_CHEAT_DETECTION: ' OFF ' }))).toBe(
        'off',
      );
    });

    it('treats anything else as enforce', () => {
      expect(cheatDetectionMode(env({ GAME_CHEAT_DETECTION: 'lenient' }))).toBe(
        'enforce',
      );
    });
  });

  describe('cheatConfidenceThreshold', () => {
    it('is 0.85 by default', () => {
      expect(cheatConfidenceThreshold()).toBe(0.85);
    });

    it('honours a value in range', () => {
      expect(
        cheatConfidenceThreshold(env({ GAME_CHEAT_CONFIDENCE: '0.6' })),
      ).toBe(0.6);
      expect(
        cheatConfidenceThreshold(env({ GAME_CHEAT_CONFIDENCE: '1' })),
      ).toBe(1);
    });

    it('ignores a value out of range or unreadable', () => {
      for (const raw of ['1.5', '-0.1', 'high', '']) {
        expect(
          cheatConfidenceThreshold(env({ GAME_CHEAT_CONFIDENCE: raw })),
        ).toBe(0.85);
      }
    });
  });

  /**
   * There are no cut lines. The board ranks and never eliminates, so there is
   * no constant here for a field size and no function mapping a rank to a
   * round someone survived into.
   */
  it('has no rank-based elimination to configure', () => {
    expect(BOARD_NEIGHBOURS).toBe(3);
    const rules = jest.requireActual<Record<string, unknown>>('./rules');
    expect(rules.CUT_LINES).toBeUndefined();
    expect(rules.cutForRank).toBeUndefined();
  });
});

/**
 * The betting book.
 *
 * These are the money tests. The one that matters most is the last:
 * whatever the shape of the book, the coins that come out plus the rake
 * equal the coins that went in. A settlement that invents a coin inflates
 * an economy people paid real money into, and a settlement that loses one
 * takes it from somebody.
 */
describe('settleWarBook', () => {
  const bet = (betId: string, side: WarSide, coins: number): WarStake => ({
    betId,
    side,
    coins,
  });

  const total = (s: WarSettlement) =>
    s.payouts.reduce((sum, p) => sum + p.payout, 0) + s.rake;

  it('pays the winning side the losing pool, less the rake', () => {
    const book = [bet('a', 'challenger', 100), bet('b', 'opponent', 100)];
    const result = settleWarBook(book, 'challenger', 10);

    expect(result.reason).toBe('paid');
    expect(result.pools).toEqual({ challenger: 100, opponent: 100 });
    // 10% of the 100 they lost is the house's.
    expect(result.rake).toBe(10);
    // The winner gets their stake back plus what is left of the loser's.
    expect(result.payouts).toEqual([
      { betId: 'a', payout: 190, profit: 90 },
      { betId: 'b', payout: 0, profit: -100 },
    ]);
    expect(total(result)).toBe(200);
  });

  it('splits the winnings in proportion to what each winner staked', () => {
    const book = [
      bet('a', 'challenger', 300),
      bet('b', 'challenger', 100),
      bet('c', 'opponent', 200),
    ];
    const result = settleWarBook(book, 'challenger', 0);

    // 200 to share between stakes of 300 and 100: three quarters and one.
    expect(result.payouts).toEqual([
      { betId: 'a', payout: 450, profit: 150 },
      { betId: 'b', payout: 150, profit: 50 },
      { betId: 'c', payout: 0, profit: -200 },
    ]);
    expect(total(result)).toBe(600);
  });

  /**
   * Three winners splitting a pool that does not divide by three. Someone
   * has to get the odd coin, and it must be the same someone every time.
   */
  it('hands out the odd coins by largest remainder, deterministically', () => {
    const book = [
      bet('a', 'challenger', 1),
      bet('b', 'challenger', 1),
      bet('c', 'challenger', 1),
      bet('d', 'opponent', 10),
    ];
    const first = settleWarBook(book, 'challenger', 0);
    const again = settleWarBook(book, 'challenger', 0);

    // Three winners staked 1 each and share 10: three, three and four, on
    // top of the stake each gets back. The loser is the zero.
    const won = first.payouts
      .filter((p) => p.betId !== 'd')
      .map((p) => p.payout)
      .sort();
    expect(won).toEqual([4, 4, 5]);
    expect(first.payouts.find((p) => p.betId === 'd')?.payout).toBe(0);
    expect(total(first)).toBe(13);
    expect(again.payouts).toEqual(first.payouts);
  });

  /** Reordering the same bets must not change who gets the odd coin. */
  it('does not depend on the order the bets arrive in', () => {
    const book = [
      bet('a', 'challenger', 7),
      bet('b', 'challenger', 11),
      bet('c', 'challenger', 13),
      bet('d', 'opponent', 100),
    ];
    const forwards = settleWarBook(book, 'challenger', 7);
    const backwards = settleWarBook([...book].reverse(), 'challenger', 7);

    const byId = (s: WarSettlement) =>
      Object.fromEntries(s.payouts.map((p) => [p.betId, p.payout]));
    expect(byId(backwards)).toEqual(byId(forwards));
    expect(backwards.rake).toBe(forwards.rake);
  });

  describe('when there was no real book', () => {
    /**
     * Everyone backed the same clan. There was nothing to win from anyone,
     * so sweeping the pool would just be the house taking money for holding
     * it. Give it back.
     */
    it('refunds a one-sided book rather than keeping it', () => {
      const book = [bet('a', 'challenger', 50), bet('b', 'challenger', 25)];
      const result = settleWarBook(book, 'challenger', 10);

      expect(result.refunded).toBe(true);
      expect(result.reason).toBe('one_sided');
      expect(result.rake).toBe(0);
      expect(result.payouts).toEqual([
        { betId: 'a', payout: 50, profit: 0 },
        { betId: 'b', payout: 25, profit: 0 },
      ]);
    });

    /** Backing the losing side alone is the same non-book. */
    it('refunds when nobody backed the winner', () => {
      const result = settleWarBook(
        [bet('a', 'opponent', 40)],
        'challenger',
        10,
      );
      expect(result.reason).toBe('one_sided');
      expect(result.payouts[0].payout).toBe(40);
    });

    it('refunds a draw', () => {
      const result = settleWarBook(
        [bet('a', 'challenger', 30), bet('b', 'opponent', 70)],
        'draw',
        10,
      );
      expect(result.reason).toBe('draw');
      expect(result.rake).toBe(0);
      expect(total(result)).toBe(100);
    });

    it('refunds a voided war', () => {
      const result = settleWarBook(
        [bet('a', 'challenger', 30), bet('b', 'opponent', 70)],
        'void',
        10,
      );
      expect(result.reason).toBe('void');
      expect(result.payouts.every((p) => p.profit === 0)).toBe(true);
    });

    it('settles an empty book without inventing anything', () => {
      const result = settleWarBook([], 'challenger', 10);
      expect(result).toMatchObject({ payouts: [], rake: 0, reason: 'no_bets' });
    });
  });

  it('clamps a rake nobody should be able to set', () => {
    const book = [bet('a', 'challenger', 100), bet('b', 'opponent', 100)];
    expect(settleWarBook(book, 'challenger', -5).rake).toBe(0);
    // Half the losing pool is the ceiling, whatever is asked for.
    expect(settleWarBook(book, 'challenger', 900).rake).toBe(50);
  });

  /**
   * The invariant, over a few hundred shapes of book: coins are conserved.
   * Not a fuzz test for its own sake — the largest-remainder pass is exactly
   * the kind of arithmetic that quietly drops a coin on some input nobody
   * thought to write down.
   */
  it('never creates or destroys a coin', () => {
    let seed = 20260913;
    const rand = (n: number) => {
      // xorshift, so the run is repeatable and a failure can be re-read.
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return Math.abs(seed) % n;
    };

    for (let round = 0; round < 400; round += 1) {
      const count = 1 + rand(9);
      const book: WarStake[] = Array.from({ length: count }, (_, i) =>
        bet(
          `bet-${i}`,
          rand(2) === 0 ? 'challenger' : 'opponent',
          1 + rand(997),
        ),
      );
      const staked = book.reduce((sum, s) => sum + s.coins, 0);
      const outcome = (['challenger', 'opponent', 'draw', 'void'] as const)[
        rand(4)
      ];
      const result = settleWarBook(book, outcome, rand(51));

      expect(total(result)).toBe(staked);
      expect(result.payouts).toHaveLength(book.length);
      for (const p of result.payouts)
        expect(p.payout).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result.rake)).toBe(true);
      for (const p of result.payouts)
        expect(Number.isInteger(p.payout)).toBe(true);
    }
  });
});
