/**
 * What state the drop is in.
 *
 * Drop culture runs on a clock, and the whole point of a countdown is that it
 * is the same clock for everybody. So the state is resolved here, on the
 * server, from the admin's dates — not in the browser, where a visitor with a
 * wrong system time would see the drop open early and the shop disagree.
 *
 * The page still counts the seconds down in the browser, because a number that
 * only moves on reload is not a countdown. But when it reaches zero the page
 * asks the server what happens next rather than deciding for itself.
 */

export type DropState =
  /** Switched off entirely. The hero renders as if there were no drop. */
  | 'off'
  /** Scheduled, not open yet. This is the one that gets a countdown. */
  | 'teaser'
  /** Open. */
  | 'live'
  /** Called sold out by hand. */
  | 'sold_out'
  /** Ran past its closing time. */
  | 'ended';

export interface DropConfig {
  enabled: boolean;
  soldOut: boolean;
  /** ISO 8601, or empty for "no scheduled opening". */
  dropAt: string;
  /** ISO 8601, or empty for "runs until it is switched off". */
  endsAt: string;
}

/**
 * The guards run in order and the first one that matches wins, which is what
 * makes the precedence readable: switched off beats everything, a hand-set
 * "sold out" beats the clock, and the clock beats the default.
 *
 * With the drop on and no dates at all, the answer is `live` — an admin who
 * turns it on without scheduling anything means it is happening now.
 */
export function resolveDropState(
  config: DropConfig,
  now: Date = new Date(),
): DropState {
  if (!config.enabled) return 'off';
  if (config.soldOut) return 'sold_out';

  const ends = parseMoment(config.endsAt);
  if (ends && now.getTime() >= ends.getTime()) return 'ended';

  const opens = parseMoment(config.dropAt);
  if (opens && now.getTime() < opens.getTime()) return 'teaser';

  return 'live';
}

/**
 * The moment the page should check back.
 *
 * Null means nothing is scheduled to change, so the page has no reason to poll
 * — and a hero that quietly refreshes itself once an hour forever is a bug
 * report about battery life waiting to be filed.
 */
export function nextTransitionAt(
  config: DropConfig,
  now: Date = new Date(),
): string | null {
  const state = resolveDropState(config, now);
  if (state === 'teaser') return parseMoment(config.dropAt)?.toISOString() ?? null;
  if (state === 'live') {
    const ends = parseMoment(config.endsAt);
    return ends && ends.getTime() > now.getTime() ? ends.toISOString() : null;
  }
  return null;
}

/** Tolerates the empty string the registry uses for "not set". */
function parseMoment(value: string): Date | null {
  if (!value) return null;
  const when = new Date(value);
  return Number.isNaN(when.getTime()) ? null : when;
}
