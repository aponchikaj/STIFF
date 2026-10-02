/**
 * `/api/game/clans/*` — two players, one leader, team tasks.
 *
 * Every route needs a session and a player enrolment. Accepting, declining
 * and handing in a clan task go through the ordinary assignment routes in
 * `game.ts`: the assignment is held by the leader, and the backend tells a
 * clan draw from a solo one by its `clanId`.
 */

import { apiFetch } from "./client";
import type { AssignmentView, ClanView, LeaveClanOutcome, SeasonDay } from "./types";

export function create(name: string) {
  return apiFetch<{ clan: ClanView }>("/game/clans", { method: "POST", body: { name } });
}

export function join(code: string) {
  return apiFetch<{ clan: ClanView }>("/game/clans/join", {
    method: "POST",
    body: { code },
  });
}

export function mine() {
  return apiFetch<{ clan: ClanView | null }>("/game/clans/mine");
}

/** Only while forming. The leader's leaving disbands it — check `disbanded`. */
export function leave() {
  return apiFetch<LeaveClanOutcome>("/game/clans/leave", { method: "POST" });
}

/** Leader only, full clan only. Draws a team task for the day. */
export function drawTask(day: SeasonDay) {
  return apiFetch<{ assignment: AssignmentView }>("/game/clans/tasks/draw", {
    method: "POST",
    body: { day },
  });
}
