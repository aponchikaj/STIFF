/**
 * How close counts as what.
 *
 * Everything here is integer. That is not fussiness: this module runs in the
 * browser to show a player their score and again on the server to decide
 * whether that score was real, and the two have to agree exactly. Floating
 * point accumulated over two thousand notes does not reliably agree with
 * itself across engines, let alone across machines.
 *
 * So: windows in whole milliseconds, score in whole points, accuracy weight in
 * hundredths of a unit, health in hundredths of a percent. Nothing is divided
 * until the very end, and then only once.
 */

export type Judgement = 'sick' | 'good' | 'bad' | 'shit' | 'miss';

export const JUDGEMENTS: readonly Judgement[] = [
  'sick',
  'good',
  'bad',
  'shit',
  'miss',
];

export interface JudgementSpec {
  /** Absolute window in ms. A press within ±this of the note earns it. */
  windowMs: number;
  score: number;
  /**
   * Contribution to accuracy, in hundredths. 100 = a full note's worth.
   * Summed as an integer and divided once, so 2,000 notes cannot drift.
   */
  accuracyWeight: number;
  /** Health change in hundredths of a percent of the full bar. */
  healthDelta: number;
  /** False breaks the combo. */
  keepsCombo: boolean;
}

/**
 * Defaults from the brief. The admin panel overrides these per difficulty,
 * which is why they are data rather than constants scattered through the
 * scorer — a run stores the table it was judged under, so retuning the game
 * never silently rewrites what an old score meant.
 */
export const DEFAULT_JUDGEMENTS: Readonly<Record<Judgement, JudgementSpec>> = {
  sick: {
    windowMs: 45,
    score: 350,
    accuracyWeight: 100,
    healthDelta: 230,
    keepsCombo: true,
  },
  good: {
    windowMs: 90,
    score: 200,
    accuracyWeight: 75,
    healthDelta: 40,
    keepsCombo: true,
  },
  bad: {
    windowMs: 135,
    score: 100,
    accuracyWeight: 30,
    healthDelta: -100,
    keepsCombo: false,
  },
  shit: {
    windowMs: 160,
    score: 50,
    accuracyWeight: 0,
    healthDelta: -300,
    keepsCombo: false,
  },
  // Not a window — a miss is what happens when no window was met in time.
  miss: {
    windowMs: 0,
    score: -10,
    accuracyWeight: 0,
    healthDelta: -475,
    keepsCombo: false,
  },
};

export type JudgementTable = Readonly<Record<Judgement, JudgementSpec>>;

/**
 * The widest window that can still judge a note. Past this, the note is gone
 * and a press in its lane hits nothing.
 */
export function missWindowMs(table: JudgementTable = DEFAULT_JUDGEMENTS): number {
  return Math.max(
    table.sick.windowMs,
    table.good.windowMs,
    table.bad.windowMs,
    table.shit.windowMs,
  );
}

/**
 * Which judgement a timing error earns, or null when it is outside every
 * window and the press should not consume the note at all.
 *
 * `deltaMs` is signed (early is negative) but only its magnitude matters —
 * the windows are symmetric. It stays signed in the API because the timing
 * histogram the anti-cheat heuristics look at needs the sign, and having two
 * functions disagree about that is exactly the bug worth avoiding.
 */
export function judge(
  deltaMs: number,
  table: JudgementTable = DEFAULT_JUDGEMENTS,
): Exclude<Judgement, 'miss'> | null {
  const distance = Math.abs(deltaMs);
  if (distance <= table.sick.windowMs) return 'sick';
  if (distance <= table.good.windowMs) return 'good';
  if (distance <= table.bad.windowMs) return 'bad';
  if (distance <= table.shit.windowMs) return 'shit';
  return null;
}

export type Rank = 'P' | 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * Rank is accuracy alone — not score, which scales with chart length and would
 * make a long easy chart outrank a short hard one.
 *
 * `F` is reserved for a failed run; a completed run never ranks below D.
 */
export function rankFor(accuracyPercent: number): Rank {
  if (accuracyPercent >= 100) return 'P';
  if (accuracyPercent >= 95) return 'S';
  if (accuracyPercent >= 90) return 'A';
  if (accuracyPercent >= 80) return 'B';
  if (accuracyPercent >= 70) return 'C';
  return 'D';
}
