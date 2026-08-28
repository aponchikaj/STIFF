import {
  DEFAULT_JUDGEMENTS,
  rankFor,
  type Judgement,
  type JudgementTable,
  type Rank,
} from './judgement';

/**
 * The running tally.
 *
 * Mutated in place rather than replaced. This is on the hot path — a note can
 * be judged sixty times a second on Extreme — and allocating a fresh object
 * per judgement is how a rhythm game acquires a GC stutter. The engine owns
 * exactly one of these per run.
 *
 * `accuracyWeightSum` and `healthUnits` are integers on purpose; see
 * `judgement.ts`.
 */
export interface ScoreState {
  score: number;
  combo: number;
  maxCombo: number;
  counts: Record<Judgement, number>;
  /** Sum of accuracy weights in hundredths. Divided exactly once, at the end. */
  accuracyWeightSum: number;
  /** How many notes have been judged — the denominator for accuracy. */
  judgedCount: number;
  /** 0..HEALTH_MAX, in hundredths of a percent. Starts at half. */
  healthUnits: number;
  /** Scored ticks from held notes. Counted separately: they are not judgements. */
  holdTicks: number;
}

export const HEALTH_MAX = 10_000;
export const HEALTH_START = HEALTH_MAX / 2;

/** Points awarded per held tick. */
export const HOLD_TICK_SCORE = 10;

/**
 * How often a held note pays out.
 *
 * A fixed interval from the note's start rather than "once per frame": frame
 * rate varies between devices and between runs on the same device, so a
 * per-frame payout would make the same performance worth different scores on a
 * phone and a desktop — and would make server replay impossible, since the
 * server has no frames at all.
 */
export const HOLD_TICK_MS = 100;

export function createScoreState(): ScoreState {
  return {
    score: 0,
    combo: 0,
    maxCombo: 0,
    counts: { sick: 0, good: 0, bad: 0, shit: 0, miss: 0 },
    accuracyWeightSum: 0,
    judgedCount: 0,
    healthUnits: HEALTH_START,
    holdTicks: 0,
  };
}

export function applyJudgement(
  state: ScoreState,
  judgement: Judgement,
  table: JudgementTable = DEFAULT_JUDGEMENTS,
): void {
  const spec = table[judgement];

  state.score += spec.score;
  state.counts[judgement]++;
  state.accuracyWeightSum += spec.accuracyWeight;
  state.judgedCount++;

  if (spec.keepsCombo) {
    state.combo++;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
  } else {
    state.combo = 0;
  }

  state.healthUnits = clampHealth(state.healthUnits + spec.healthDelta);
}

export function applyHoldTick(state: ScoreState): void {
  // Deliberately not a judgement: hold ticks add score but do not touch
  // accuracy or combo. Letting them count toward accuracy would mean a chart
  // full of long holds could reach 100% while its taps were sloppy.
  state.holdTicks++;
  state.score += HOLD_TICK_SCORE;
}

function clampHealth(units: number): number {
  if (units < 0) return 0;
  if (units > HEALTH_MAX) return HEALTH_MAX;
  return units;
}

export function isDead(state: ScoreState): boolean {
  return state.healthUnits <= 0;
}

/**
 * Accuracy as a percentage, 0–100, rounded to three decimals.
 *
 * One division, at the end, over integers — so the result is a pure function
 * of the counts and cannot drift with the order judgements arrived in. Three
 * decimals because that is what `game_runs.accuracy` stores as `numeric(6,3)`;
 * rounding here rather than at the database means the client displays exactly
 * what the server will persist.
 */
export function accuracyPercent(state: ScoreState): number {
  if (state.judgedCount === 0) return 0;
  const raw = state.accuracyWeightSum / state.judgedCount;
  return Math.round(raw * 1000) / 1000;
}

export function rankOf(state: ScoreState): Rank {
  return rankFor(accuracyPercent(state));
}

/** Health as a 0–100 percentage, for the bar. */
export function healthPercent(state: ScoreState): number {
  return (state.healthUnits / HEALTH_MAX) * 100;
}
