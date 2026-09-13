/**
 * The rules of the game that are numbers, names or strings — in one place.
 *
 * Every one of these is something a player will argue with ("it said four"),
 * and the answer must not depend on which service happened to hard-code it.
 * Pure constants and pure functions only: no Nest, no database, so the rules
 * can be tested by reading them.
 *
 * Where a rule is operational rather than product (the daily minimum, the
 * cheat-detector's mode) it can be tuned from the environment, but it always
 * has a default and the default is the rule as designed.
 */

/** The game is 16+, strictly. Enforced at sign-up and again at enrolment. */
export const MINIMUM_AGE = 16;

/**
 * How many tasks a player must hand in every day to stay a player.
 *
 * Four minimum, no maximum. A player who hands in fewer on a day the season
 * was running is moved to watcher by the nightly sweep — see
 * `DisciplineService.sweepDailyMinimum`.
 */
export const DEFAULT_DAILY_MINIMUM_TASKS = 4;

/**
 * The day boundary the sweeps use. The game is played in Tbilisi, so "today"
 * means today there, not UTC — a player who hands in at 23:30 local should be
 * counted for the day they think it is.
 */
export const GAME_TIMEZONE = 'Asia/Tbilisi';

/** What a cheater's comments are shown as. Verbatim, by design. */
export const CHEATER_NOTICE = 'CHEATER WROTE A COMMENT';

/**
 * How sure the model has to be before an account is punished on its word.
 *
 * Below this a `cheating` verdict is stored as `suspicious` for a person to
 * look at rather than acted on. A wrong automatic zeroing costs the game a
 * player who was honest; a missed one costs it one attempt that a reviewer
 * still sees.
 */
export const DEFAULT_CHEAT_CONFIDENCE_THRESHOLD = 0.85;

export type CheatDetectionMode = 'enforce' | 'shadow' | 'off';

interface EnvReader {
  get<T = string>(key: string): T | undefined;
}

/** `GAME_DAILY_MINIMUM_TASKS`, or four. Anything unreadable is four. */
export function dailyMinimumTasks(env?: EnvReader): number {
  const raw = env?.get<string>('GAME_DAILY_MINIMUM_TASKS');
  const parsed = raw === undefined ? NaN : Number.parseInt(String(raw), 10);
  return Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_DAILY_MINIMUM_TASKS;
}

/**
 * `GAME_CHEAT_DETECTION`: `enforce` (the default — a confident verdict zeroes
 * the account), `shadow` (verdicts are stored, nothing moves) or `off`.
 */
export function cheatDetectionMode(env?: EnvReader): CheatDetectionMode {
  const raw = env?.get<string>('GAME_CHEAT_DETECTION')?.trim().toLowerCase();
  return raw === 'shadow' || raw === 'off' ? raw : 'enforce';
}

/** `GAME_CHEAT_CONFIDENCE`, a number in [0, 1]; otherwise the default. */
export function cheatConfidenceThreshold(env?: EnvReader): number {
  const raw = env?.get<string>('GAME_CHEAT_CONFIDENCE');
  const parsed = raw === undefined ? NaN : Number.parseFloat(String(raw));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : DEFAULT_CHEAT_CONFIDENCE_THRESHOLD;
}

/** A clan is exactly two people: a leader and one member. */
export const CLAN_SIZE = 2;

/** Failing a team task costs each member this many coins — a template picks. */
export const MIN_PENALTY_COINS = 1;
export const MAX_PENALTY_COINS = 3;

/** Clamp a template's penalty into the rule. */
export function clampPenalty(value: unknown): number {
  const n =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.round(value)
      : MIN_PENALTY_COINS;
  return Math.min(Math.max(n, MIN_PENALTY_COINS), MAX_PENALTY_COINS);
}

/** Watchers vote on a hand-in for this long after it is confirmed. */
export const VOTING_WINDOW_HOURS = 3;

/** A correct "yes" vote pays this much — the resolver picks within the range. */
export const VOTE_REWARD_MIN_COINS = 2;
export const VOTE_REWARD_MAX_COINS = 5;

/** After a paid vote, a watcher earns nothing from votes for this long. */
export const VOTE_WIN_COOLDOWN_HOURS = 5;

/** Clamp a resolver's payout into the rule; anything unreadable is the floor. */
export function clampVoteReward(value: unknown): number {
  const n =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.round(value)
      : VOTE_REWARD_MIN_COINS;
  return Math.min(Math.max(n, VOTE_REWARD_MIN_COINS), VOTE_REWARD_MAX_COINS);
}

/** The payout when the resolver could not say: by how hard the tier was. */
export function defaultVoteReward(tier: number): number {
  return clampVoteReward(tier >= 3 ? 5 : tier === 2 ? 3 : 2);
}

/**
 * How many rows either side of a player `GET /leaderboard/me` shows.
 *
 * The board ranks; it does not cut. Nobody is eliminated by their position on
 * it, so a rank is a standing rather than a sentence, and the rows around it
 * are there for context rather than to show someone how close they are to
 * being dropped.
 */
export const BOARD_NEIGHBOURS = 3;

// ------------------------------------------------------------ clan wars --

/**
 * A clan war runs for four hours. Long enough that a clan has to actually
 * play through it rather than sprint one task, short enough to be watchable
 * in an evening.
 */
export const WAR_DURATION_HOURS = 4;

/**
 * The book closes when the war starts, so a war has to be scheduled far
 * enough ahead for anyone to bet on it. Half an hour is the floor.
 */
export const WAR_MIN_LEAD_MINUTES = 30;

/** And nobody schedules a grudge match for next month. */
export const WAR_MAX_LEAD_DAYS = 7;

/**
 * How long a finished war waits for its hand-ins to be judged before it is
 * settled on whatever has been decided. Two days is generous; without a
 * deadline an unreviewed clip freezes everyone's stake indefinitely.
 */
export const WAR_JUDGING_DEADLINE_HOURS = 48;

/** Stake bounds, in coins. A bet nobody can feel is not a bet. */
export const WAR_MIN_STAKE_COINS = 1;
export const DEFAULT_WAR_MAX_STAKE_COINS = 500;

/** The house's cut of the losing pool, as a percentage. */
export const DEFAULT_WAR_RAKE_PERCENT = 10;

/** `GAME_WAR_RAKE_PERCENT`, 0–50. Anything unreadable is the default. */
export function warRakePercent(env?: EnvReader): number {
  const raw = env?.get<string>('GAME_WAR_RAKE_PERCENT');
  const parsed = raw === undefined ? NaN : Number.parseInt(String(raw), 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 50
    ? parsed
    : DEFAULT_WAR_RAKE_PERCENT;
}

/** `GAME_WAR_MAX_STAKE`, at least the minimum. Otherwise the default. */
export function warMaxStake(env?: EnvReader): number {
  const raw = env?.get<string>('GAME_WAR_MAX_STAKE');
  const parsed = raw === undefined ? NaN : Number.parseInt(String(raw), 10);
  return Number.isInteger(parsed) && parsed >= WAR_MIN_STAKE_COINS
    ? parsed
    : DEFAULT_WAR_MAX_STAKE_COINS;
}

export type WarSide = 'challenger' | 'opponent';

/** One person's stake going in. */
export interface WarStake {
  betId: string;
  side: WarSide;
  coins: number;
}

/** What that person gets back. `payout` includes their own stake returned. */
export interface WarPayout {
  betId: string;
  /** Coins credited back. Zero for a losing bet. */
  payout: number;
  /** Payout minus the stake: what they actually won or lost. */
  profit: number;
}

export interface WarSettlement {
  payouts: WarPayout[];
  /** Total staked on each side, before anything moves. */
  pools: Record<WarSide, number>;
  /** The house's cut, in coins. Zero on a refund. */
  rake: number;
  /** True when every stake came straight back. */
  refunded: boolean;
  /** Why, when it was refunded. */
  reason: 'paid' | 'draw' | 'one_sided' | 'no_bets' | 'void';
}

/**
 * Who gets what when a war ends.
 *
 * **Parimutuel, not fixed odds**, and that is the whole design. With fixed
 * odds the house takes the other side of every bet and can lose; pricing it
 * needs a bookmaker. Here the bettors are betting against each other: the
 * winning side splits the losing side's stake in proportion to what each of
 * them put in, and the house takes a fixed percentage of the losing pool.
 * The house therefore cannot lose, and nobody has to price anything.
 *
 * **Coins are integers and none may be invented.** The proportional split
 * almost never divides evenly, so it is done by largest remainder: floor
 * every share, then hand the leftover coins out one each to the bets with
 * the largest fractional part, ties broken by stake and then by id so the
 * result is deterministic. What cannot be handed out that way — nothing,
 * after the remainder pass — would go to the rake. The guarantee this
 * function keeps is exact:
 *
 *     sum(payouts) + rake === sum(stakes)
 *
 * **A one-sided book is refunded, not swept.** If everyone backed the same
 * clan there was no bet, only the house collecting. Same for a draw and for
 * a war with no bets at all. Refunding is the honest answer and it is what
 * `reason` records.
 */
export function settleWarBook(
  stakes: WarStake[],
  outcome: WarSide | 'draw' | 'void',
  rakePercent: number,
): WarSettlement {
  const pools: Record<WarSide, number> = { challenger: 0, opponent: 0 };
  for (const s of stakes) pools[s.side] += s.coins;

  const refundAll = (reason: WarSettlement['reason']): WarSettlement => ({
    payouts: stakes.map((s) => ({
      betId: s.betId,
      payout: s.coins,
      profit: 0,
    })),
    pools,
    rake: 0,
    refunded: true,
    reason,
  });

  if (stakes.length === 0) {
    return { payouts: [], pools, rake: 0, refunded: true, reason: 'no_bets' };
  }
  if (outcome === 'void') return refundAll('void');
  if (outcome === 'draw') return refundAll('draw');

  const winPool = pools[outcome];
  const losePool = pools[outcome === 'challenger' ? 'opponent' : 'challenger'];
  // Nobody to pay, or nobody to pay from: there was no book here.
  if (winPool === 0 || losePool === 0) return refundAll('one_sided');

  const clampedRake = Math.min(Math.max(Math.round(rakePercent), 0), 50);
  const rake = Math.floor((losePool * clampedRake) / 100);
  const distributable = losePool - rake;

  // Floor each winner's share, then hand out the remainder one coin at a
  // time. Sorting by fractional part, then stake, then id keeps it
  // deterministic — two settlements of the same book agree exactly.
  const winners = stakes.filter((s) => s.side === outcome);
  const shares = winners.map((s) => {
    const exact = (s.coins * distributable) / winPool;
    const whole = Math.floor(exact);
    return { stake: s, whole, remainder: exact - whole };
  });
  let handedOut = shares.reduce((sum, s) => sum + s.whole, 0);
  const leftover = distributable - handedOut;
  const byRemainder = [...shares].sort(
    (a, b) =>
      b.remainder - a.remainder ||
      b.stake.coins - a.stake.coins ||
      (a.stake.betId < b.stake.betId ? -1 : 1),
  );
  for (let i = 0; i < leftover; i += 1) {
    byRemainder[i % byRemainder.length].whole += 1;
    handedOut += 1;
  }

  const wonBy = new Map(shares.map((s) => [s.stake.betId, s.whole]));
  const payouts: WarPayout[] = stakes.map((s) => {
    if (s.side !== outcome)
      return { betId: s.betId, payout: 0, profit: -s.coins };
    const won = wonBy.get(s.betId) ?? 0;
    return { betId: s.betId, payout: s.coins + won, profit: won };
  });

  return { payouts, pools, rake, refunded: false, reason: 'paid' };
}
