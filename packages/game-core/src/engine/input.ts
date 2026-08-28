import type { Lane } from '../chart/types';

/**
 * One thing the player did, timestamped against the audio clock.
 *
 * `tMs` is milliseconds from the start of the song, already corrected for the
 * player's audio offset by whoever produced the event. The engine does no
 * offset arithmetic of its own — if it did, the server would have to be told
 * the offset and trust it, which turns a calibration setting into a scoring
 * exploit. The client applies the offset when it timestamps; the server
 * replays exactly what it was given.
 */
export interface InputEvent {
  tMs: number;
  lane: Lane;
  type: 'press' | 'release';
}

/**
 * Sorted, integer-timed, and with no release before its press.
 *
 * Worth asserting rather than assuming: an input log arrives from a client,
 * and a malformed one must be a rejection with a reason rather than an
 * exception in the middle of scoring.
 */
export function validateInputLog(events: readonly InputEvent[]): string | null {
  let previous = -Infinity;
  const held = new Set<Lane>();

  for (const [index, event] of events.entries()) {
    if (!Number.isInteger(event.tMs)) {
      return `event ${index}: tMs ${event.tMs} is not an integer`;
    }
    if (event.tMs < previous) {
      return `event ${index}: tMs ${event.tMs} is before the previous event`;
    }
    if (event.lane < 0 || event.lane > 3) {
      return `event ${index}: lane ${event.lane} is out of range`;
    }
    previous = event.tMs;

    if (event.type === 'press') {
      // A second press with no release between is not fatal — a dropped
      // release happens when the window loses focus — so the engine treats it
      // as a re-press rather than refusing the whole log.
      held.add(event.lane);
    } else {
      held.delete(event.lane);
    }
  }
  return null;
}
