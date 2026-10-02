/**
 * `/api/game/votes/*` — how a watcher earns.
 *
 * Watchers only, both routes. A player's opinion of another player's hand-in
 * is not evidence, and the coins are the audience's.
 */

import { apiFetch } from "./client";
import type { VotableItem, VoteOutcome, VoteValue } from "./types";

/** Hand-ins whose window is open, with the tallies and my own vote. */
export function open() {
  return apiFetch<{ items: VotableItem[] }>("/game/votes/open");
}

export function vote(attemptId: string, value: VoteValue) {
  return apiFetch<VoteOutcome>(`/game/votes/${attemptId}`, {
    method: "POST",
    body: { vote: value },
  });
}
