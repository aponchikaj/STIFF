/**
 * `/api/game/*` — the player and watcher API. One function per route on
 * `backend/src/game/game.controller.ts`, in the controller's own order.
 *
 * The reading half works signed out: the feed, the board, the pool, the
 * season and the rules are all `@Public()`. Anything that changes something
 * needs a session; anything that hands something in needs an enrolment too.
 */

import { apiFetch, saveTokens } from "./client";
import type {
  AssignmentView,
  AttemptView,
  Board,
  CommentView,
  ConfirmAttemptInput,
  Dashboard,
  DeclineOutcome,
  EnrolInput,
  EnrolmentView,
  FeedItem,
  FeedPage,
  FeedQuery,
  GameRegisterInput,
  GameRegisterResult,
  GameRules,
  LeaderboardQuery,
  LikeOutcome,
  PlayableTask,
  PlayableTasksQuery,
  PlayerSearchResult,
  RequestUploadInput,
  RoleChoice,
  Season,
  SeasonDay,
  ShareOutcome,
  Standing,
  UploadTicket,
} from "./types";

/* ------------------------------------------------------------ the season */

/** Unauthenticated liveness. The game origin polls it before asking anyone
 *  to sign in, so a dead API shows as "offline" rather than "wrong password". */
export function health() {
  return apiFetch<{ status: "ok"; live: boolean }>("/game/health");
}

/** The numbers a client must state up front, from the server's constants.
 *  Never hardcode hearts or the daily minimum in a screen — read them here. */
export function rules() {
  return apiFetch<GameRules>("/game/rules");
}

export function season() {
  return apiFetch<{ season: Season | null }>("/game/season");
}

/* --------------------------------------------------------- the front door */

/**
 * Sign up from the game: a side, an account and a session in one request.
 *
 * Creates an ordinary **shop** account — there is no separate game user — so
 * the returned tokens work on stiff.ge too. The age gate runs before the
 * account exists, which is why a rejection leaves nothing behind.
 */
export async function register(input: GameRegisterInput) {
  const result = await apiFetch<GameRegisterResult>("/game/register", {
    method: "POST",
    body: input,
  });
  // Saved here, not by the caller: the mutation's `onSuccess` refetches the
  // session before the caller's `await` resumes, and that refetch has to go
  // out with the token already in storage.
  saveTokens(result);
  return result;
}

/* ------------------------------------------------------------- enrolment */

/** Take a side with an account that already exists — the path in from
 *  stiff.ge. A shop account was never asked its age, so the first call must
 *  send `birthDate`. */
export function enrol(input: EnrolInput) {
  return apiFetch<RoleChoice>("/game/enrolments", { method: "POST", body: input });
}

export function myEnrolment() {
  return apiFetch<{ enrolment: EnrolmentView | null }>("/game/enrolments/me");
}

/** Everything the dashboard renders, in one call — deliberately, so a phone
 *  does not show a half-built screen across three round trips. */
export function dashboard() {
  return apiFetch<Dashboard>("/game/me");
}

/* ---------------------------------------------------------------- tasks */

/** The pool, for reading. Approved tasks only — playing goes through a draw. */
export function tasks(query: PlayableTasksQuery = {}) {
  return apiFetch<{ tasks: PlayableTask[] }>("/game/tasks", { query: { ...query } });
}

/** Draws the day's task. The server picks. A draw while an offer is already
 *  waiting returns that same offer rather than a second one. */
export function drawTask(day: SeasonDay) {
  return apiFetch<{ assignment: AssignmentView }>("/game/tasks/draw", {
    method: "POST",
    body: { day },
  });
}

/** The offer waiting or the clock running, with seconds left. */
export function currentAssignment() {
  return apiFetch<{ assignment: AssignmentView | null }>("/game/assignments/current");
}

/** Starts the clock. */
export function acceptAssignment(id: string) {
  return apiFetch<{ assignment: AssignmentView }>(`/game/assignments/${id}/accept`, {
    method: "POST",
  });
}

/** Says no. Costs a heart; the last heart makes them a watcher — check
 *  `demoted` on the response before routing back to a player screen. */
export function declineAssignment(id: string) {
  return apiFetch<DeclineOutcome>(`/game/assignments/${id}/decline`, {
    method: "POST",
  });
}

/* -------------------------------------------------------- handing in proof */

/** Step one of two. Returns a URL the browser `PUT`s the file to directly —
 *  the bytes never pass through the API. See `uploadToSignedUrl`. */
export function requestUpload(input: RequestUploadInput) {
  return apiFetch<UploadTicket>("/game/attempts/upload-url", {
    method: "POST",
    body: input,
  });
}

/** Step two: the file is in storage, so the row becomes a real attempt.
 *  The media claims are re-checked here — a client that lied in step one is
 *  caught now. */
export function confirmAttempt(id: string, input: ConfirmAttemptInput) {
  return apiFetch<{ attempt: AttemptView }>(`/game/attempts/${id}/confirm`, {
    method: "POST",
    body: input,
  });
}

export function myAttempts() {
  return apiFetch<{ attempts: AttemptView[] }>("/game/attempts/mine");
}

/* ----------------------------------------------------------------- feed */

export function feed(query: FeedQuery = {}) {
  return apiFetch<FeedPage>("/game/feed", { query: { ...query } });
}

export function feedItem(id: string) {
  return apiFetch<{ item: FeedItem }>(`/game/feed/${id}`);
}

export function toggleLike(id: string) {
  return apiFetch<LikeOutcome>(`/game/feed/${id}/like`, { method: "POST" });
}

/** A tap on share, counted. Public: the share sheet works signed out,
 *  because Instagram has no web API for Stories and requiring an account to
 *  tap it would only lose the share. */
export function recordShare(id: string) {
  return apiFetch<ShareOutcome>(`/game/feed/${id}/share`, { method: "POST" });
}

export function comments(id: string) {
  return apiFetch<{ comments: CommentView[] }>(`/game/feed/${id}/comments`);
}

export function addComment(id: string, body: string) {
  return apiFetch<{ comment: CommentView }>(`/game/feed/${id}/comments`, {
    method: "POST",
    body: { body },
  });
}

export function removeComment(commentId: string) {
  return apiFetch<{ success: true }>(`/game/comments/${commentId}`, {
    method: "DELETE",
  });
}

/* ------------------------------------------------- board + player search */

export function leaderboard(query: LeaderboardQuery = {}) {
  return apiFetch<Board>("/game/leaderboard", { query: { ...query } });
}

/** Where the caller stands, with the rows either side. Signed in only — it
 *  is about the person asking, and a demoted player gets the honest answer. */
export function standing() {
  return apiFetch<Standing>("/game/leaderboard/me");
}

/** Players only. A watcher chose the audience and is not a search result. */
export function searchPlayers(q: string) {
  return apiFetch<{ players: PlayerSearchResult[] }>("/game/players/search", {
    query: { q },
  });
}
