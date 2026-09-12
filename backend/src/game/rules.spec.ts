import {
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
