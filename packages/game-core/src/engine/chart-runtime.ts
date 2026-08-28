import { resolveNote, type Chart, type Lane, type ResolvedNote } from '../chart/types';
import {
  DEFAULT_JUDGEMENTS,
  judge,
  missWindowMs,
  type Judgement,
  type JudgementTable,
} from '../scoring/judgement';
import {
  applyHoldTick,
  applyJudgement,
  createScoreState,
  HOLD_TICK_MS,
  isDead,
  type ScoreState,
} from '../scoring/score-state';

/**
 * The whole game, minus pictures and sound.
 *
 * This class is driven two ways and must behave identically under both:
 *
 * - **Live**, by the game client: `update(songPosMs)` once per frame from the
 *   audio clock, `press`/`release` from real input.
 * - **Replayed**, by the server: `replay()` feeds it a recorded input log with
 *   no frames at all.
 *
 * That is the point. Server-side validation is not a second implementation of
 * scoring that has to be kept in step with the first — it is the first one,
 * fed from a log. The only way they can disagree is if something in here reads
 * a clock, a random number, or a frame rate, and nothing does: every method
 * takes the time it should act at as an argument.
 */

export interface NoteState {
  note: ResolvedNote;
  /** Index into the original chart's note array, for the renderer. */
  index: number;
  judgement: Judgement | null;
  /** When the player hit it. Null until judged. */
  hitAtMs: number | null;
  /** Signed timing error in ms; negative is early. Null until judged. */
  deltaMs: number | null;
  /** Holds only: the last tick already paid out. */
  lastTickMs: number;
  /** Holds only: false once the player lets go early. */
  holding: boolean;
}

export interface RuntimeOptions {
  table?: JudgementTable;
  /** No-fail: health still moves, but reaching zero does not end the run. */
  noFail?: boolean;
}

export interface JudgementEvent {
  note: NoteState;
  judgement: Judgement;
  deltaMs: number;
}

export class ChartRuntime {
  readonly state: ScoreState = createScoreState();
  readonly notes: NoteState[] = [];

  private readonly table: JudgementTable;
  private readonly noFail: boolean;
  private readonly missWindow: number;

  /** Player notes per lane, in time order, with a cursor into each. */
  private readonly byLane: NoteState[][] = [[], [], [], []];
  private readonly laneCursor: number[] = [0, 0, 0, 0];
  private readonly laneHeld: boolean[] = [false, false, false, false];

  /** Sweep cursor over player notes in time order, for miss detection. */
  private readonly inTimeOrder: NoteState[] = [];
  private missCursor = 0;

  /**
   * Holds currently paying out. Kept as its own short list because the
   * alternative — scanning every note each frame to find the two that are
   * being held — is O(notes) sixty times a second on a chart with two
   * thousand of them, which is exactly the budget the render loop needs.
   */
  private readonly activeHolds: NoteState[] = [];

  private positionMs = 0;
  private failed = false;

  /**
   * Judgements produced since the caller last drained them. The renderer wants
   * to know what just happened without diffing the whole note array; draining
   * rather than emitting avoids a callback on the hot path.
   */
  private readonly pending: JudgementEvent[] = [];

  constructor(chart: Chart, options: RuntimeOptions = {}) {
    this.table = options.table ?? DEFAULT_JUDGEMENTS;
    this.noFail = options.noFail ?? false;
    this.missWindow = missWindowMs(this.table);

    chart.notes.forEach((raw, index) => {
      const note = resolveNote(raw);
      const state: NoteState = {
        note,
        index,
        judgement: null,
        hitAtMs: null,
        deltaMs: null,
        lastTickMs: note.t,
        holding: false,
      };
      this.notes.push(state);

      // Only the player's side is judged. The opponent's notes exist for the
      // renderer and the character animations, and are never hit or missed.
      if (note.side !== 'player') return;
      if (note.kind === 'noScore') return;
      this.byLane[note.lane]?.push(state);
      this.inTimeOrder.push(state);
    });

    for (const lane of this.byLane) lane.sort((a, b) => a.note.t - b.note.t);
    this.inTimeOrder.sort((a, b) => a.note.t - b.note.t);
  }

  get songPosMs(): number {
    return this.positionMs;
  }

  get isFailed(): boolean {
    return this.failed;
  }

  /** True once every player note has been judged. */
  get isComplete(): boolean {
    return this.missCursor >= this.inTimeOrder.length;
  }

  /**
   * Advance the clock. Emits misses for notes whose window has closed and pays
   * out hold ticks that have come due.
   *
   * Monotonic: going backwards is a caller bug, not something to handle
   * gracefully, because the audio clock never does it and a replay never does
   * either.
   */
  update(songPosMs: number): void {
    if (songPosMs < this.positionMs) return;
    this.positionMs = songPosMs;

    // Misses: a note whose widest window has closed unjudged.
    while (this.missCursor < this.inTimeOrder.length) {
      const candidate = this.inTimeOrder[this.missCursor];
      if (!candidate) break;
      if (candidate.judgement !== null) {
        this.missCursor++;
        continue;
      }
      if (songPosMs <= candidate.note.t + this.missWindow) break;

      candidate.judgement = 'miss';
      applyJudgement(this.state, 'miss', this.table);
      this.pending.push({ note: candidate, judgement: 'miss', deltaMs: NaN });
      this.missCursor++;
    }

    this.payHoldTicks(songPosMs);
    this.checkFail();
  }

  /**
   * A lane went down. Returns the judgement earned, or null when there was
   * nothing in range.
   *
   * A press with no note in range costs nothing. Penalising it ("ghost
   * tapping") punishes a mistimed stray touch on a phone far more than it
   * punishes mashing, and mashing is already unrewarding because every note it
   * lands early enough to reach is judged on its real timing error.
   */
  press(lane: Lane, tMs: number): Judgement | null {
    this.laneHeld[lane] = true;

    const target = this.nextUnjudged(lane, tMs);
    if (!target) return null;

    const deltaMs = tMs - target.note.t;
    const judgement = judge(deltaMs, this.table);
    if (judgement === null) return null;

    target.judgement = judgement;
    target.hitAtMs = tMs;
    target.deltaMs = deltaMs;
    if (target.note.holdMs > 0) {
      target.holding = true;
      // Ticks are counted from the note's own time, not from when it was hit,
      // so an early and a late hit on the same hold pay out identically.
      target.lastTickMs = target.note.t;
      this.activeHolds.push(target);
    }

    applyJudgement(this.state, judgement, this.table);
    this.pending.push({ note: target, judgement, deltaMs });
    this.checkFail();
    return judgement;
  }

  release(lane: Lane, tMs: number): void {
    this.laneHeld[lane] = false;
    // Pay anything owed up to the moment of release, then stop the hold. A
    // player who lets go at 90% of a long hold keeps the 90% they earned.
    this.payHoldTicks(tMs);
    for (let i = this.activeHolds.length - 1; i >= 0; i--) {
      const note = this.activeHolds[i];
      if (!note || note.note.lane !== lane) continue;
      note.holding = false;
      this.activeHolds.splice(i, 1);
    }
  }

  /** Judgements since the last drain. The array is reused; copy if retaining. */
  drainJudgements(): JudgementEvent[] {
    const drained = this.pending.slice();
    this.pending.length = 0;
    return drained;
  }

  /**
   * The nearest unjudged note in this lane within the widest window.
   *
   * Nearest rather than earliest: on a dense chart two notes can both be in
   * range, and awarding the earlier one would score a late hit on note A when
   * the player was clearly hitting note B — and then miss B as well, turning
   * one small error into two.
   */
  private nextUnjudged(lane: Lane, tMs: number): NoteState | null {
    const notes = this.byLane[lane];
    if (!notes) return null;

    // Advance the cursor past everything already resolved or out of reach.
    let cursor = this.laneCursor[lane] ?? 0;
    while (cursor < notes.length) {
      const note = notes[cursor];
      if (!note) break;
      if (note.judgement === null && tMs <= note.note.t + this.missWindow) break;
      cursor++;
    }
    this.laneCursor[lane] = cursor;

    let best: NoteState | null = null;
    let bestDistance = Infinity;
    for (let i = cursor; i < notes.length; i++) {
      const note = notes[i];
      if (!note) continue;
      const distance = Math.abs(tMs - note.note.t);
      if (note.note.t - tMs > this.missWindow) break;
      if (note.judgement !== null) continue;
      if (distance < bestDistance) {
        best = note;
        bestDistance = distance;
      }
    }
    return bestDistance <= this.missWindow ? best : null;
  }

  /** Walks backwards so a finished hold can be dropped without reindexing. */
  private payHoldTicks(songPosMs: number): void {
    for (let i = this.activeHolds.length - 1; i >= 0; i--) {
      const note = this.activeHolds[i];
      if (!note) continue;
      const endMs = note.note.t + note.note.holdMs;
      const until = Math.min(songPosMs, endMs);
      while (note.lastTickMs + HOLD_TICK_MS <= until) {
        note.lastTickMs += HOLD_TICK_MS;
        applyHoldTick(this.state);
      }
      if (songPosMs >= endMs) {
        note.holding = false;
        this.activeHolds.splice(i, 1);
      }
    }
  }

  private checkFail(): void {
    if (!this.noFail && isDead(this.state)) this.failed = true;
  }
}
