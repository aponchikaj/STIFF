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
