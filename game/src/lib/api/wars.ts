/**
 * `/api/game/wars/*` — clan wars and the coin book on them.
 *
 * Reading is public: a war is something to watch, and the pools are part of
 * what makes it worth watching. Nothing identifying a bettor is ever in a
 * public response — only totals and a count. Everything that moves coins
 * needs a session.
 */

import { apiFetch } from "./client";
import type { PlaceBetInput, ProposeWarInput, WarFilter, WarView } from "./types";

export function list(filter?: WarFilter) {
  return apiFetch<{ wars: WarView[] }>("/game/wars", { query: { filter } });
}

export function get(id: string) {
  return apiFetch<{ war: WarView }>(`/game/wars/${id}`);
}

/** A leader challenges another full clan. */
export function propose(input: ProposeWarInput) {
  return apiFetch<{ war: WarView }>("/game/wars", { method: "POST", body: input });
}

export function accept(id: string) {
  return apiFetch<{ war: WarView }>(`/game/wars/${id}/accept`, { method: "POST" });
}

export function decline(id: string) {
  return apiFetch<{ war: WarView }>(`/game/wars/${id}/decline`, { method: "POST" });
}

/** The challenger calls it off before it starts. Refunds every bet. */
export function withdraw(id: string) {
  return apiFetch<{ war: WarView }>(`/game/wars/${id}/withdraw`, { method: "POST" });
}

/** Coins on a side. Check `war.canBet.allowed` before offering the control —
 *  a member of either clan is barred, and the reason is worth showing. */
export function placeBet(id: string, input: PlaceBetInput) {
  return apiFetch<{ war: WarView }>(`/game/wars/${id}/bets`, {
    method: "POST",
    body: input,
  });
}
