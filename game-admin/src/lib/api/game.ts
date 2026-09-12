import { apiFetch } from "./client";
import type {
  AdjustScoreInput,
  AdjustScoreResult,
  AdminReportView,
  Board,
  CreateSeasonInput,
  CreateShopItemInput,
  FlagCheaterInput,
  GameAttempt,
  GameEnrolment,
  GamePurchase,
  GameRules,
  GameSeason,
  GameShopItem,
  GameTaskTemplate,
  GenerateTasksInput,
  GenerateTasksResult,
  ListEnrolmentsParams,
  ListPurchasesParams,
  ListReportsParams,
  ListTemplatesParams,
  PoolStats,
  PublicSeason,
  ReinstateInput,
  ReportDetail,
  ReportPriority,
  ReportStats,
  ResolveReportInput,
  ResolveReportResult,
  ResolveVotesResult,
  ReviewQueue,
  ReviewQueueParams,
  ScoreLedgerRow,
  SeasonStatus,
  SetPurchaseStatusInput,
  SettleInput,
  SweepsResult,
  UpdateShopItemInput,
} from "./game-types";

/**
 * The game's admin API — `/api/game/admin/*` and `/api/game/admin/reports/*`
 * — plus the handful of public game reads the panel shows alongside.
 *
 * One function per route, named for what the route does rather than for its
 * path, so a tab reads as a list of verbs. Every admin call is written to the
 * audit log by the backend; nothing here needs to log again.
 */

const ADMIN = "/game/admin";
const id = (value: string) => encodeURIComponent(value);

// ---------------------------------------------------------- public reads --

/** The season being played, or null between seasons. A public subset. */
export function getSeason(): Promise<{ season: PublicSeason | null }> {
  return apiFetch("/game/season");
}

/** The constants the server plays by — the same numbers the game states. */
export function getRules(): Promise<GameRules> {
  return apiFetch("/game/rules");
}

/** The Nerve board, players only, high to low, with the cut lines. */
export function getLeaderboard(params?: {
  page?: number;
  pageSize?: number;
}): Promise<Board> {
  return apiFetch("/game/leaderboard", { query: { ...params } });
}

/** Players by handle. Watchers are never returned, by design. */
export function searchPlayers(q: string): Promise<{ players: Board["rows"] }> {
  return apiFetch("/game/players/search", { query: { q } });
}

// -------------------------------------------------------------- seasons --

export function listSeasons(): Promise<{ seasons: GameSeason[] }> {
  return apiFetch(`${ADMIN}/seasons`);
}

/** Always lands as `draft`; opening it is a second, deliberate step. */
export function createSeason(input: CreateSeasonInput): Promise<GameSeason> {
  return apiFetch(`${ADMIN}/seasons`, { method: "POST", body: input });
}

/**
 * `draft → open → running → closed`. Only one season may be open or running
 * at a time; the backend refuses a second with a 409 naming the live one.
 * Going `running` stamps `startsAt`; `closed` stamps `endsAt`.
 */
export function setSeasonStatus(
  seasonId: string,
  status: SeasonStatus,
): Promise<GameSeason> {
  return apiFetch(`${ADMIN}/seasons/${id(seasonId)}/status`, {
    method: "PATCH",
    body: { status },
  });
}

// --------------------------------------------------------------- review --

/** Hand-ins waiting for a verdict, oldest first, with what the model thought. */
export function getReviewQueue(params?: ReviewQueueParams): Promise<ReviewQueue> {
  return apiFetch(`${ADMIN}/review`, { query: { ...params } });
}

/**
 * The verdict. The only thing that puts an attempt in the feed. Pays the
 * task's Nerve and coins on approve, charges a clan's penalty on reject,
 * closes any open vote, and burns a heart when asked to.
 */
export function settleAttempt(
  attemptId: string,
  input: SettleInput,
): Promise<GameAttempt> {
  return apiFetch(`${ADMIN}/attempts/${id(attemptId)}/settle`, {
    method: "POST",
    body: input,
  });
}

/** Out of the feed, and its Nerve back off the board through the ledger. */
export function unpublishAttempt(attemptId: string): Promise<GameAttempt> {
  return apiFetch(`${ADMIN}/attempts/${id(attemptId)}/unpublish`, {
    method: "POST",
  });
}

// ------------------------------------------------------------ enrolments --

/** Who is in the live season. Empty between seasons. */
export function listEnrolments(
  params?: ListEnrolmentsParams,
): Promise<{ enrolments: GameEnrolment[] }> {
  return apiFetch(`${ADMIN}/enrolments`, { query: { ...params } });
}

/**
 * Same consequence as the model's confident verdict: Nerve, hearts and coins
 * to zero, role to watcher, marked as a cheater. Refused with a 409 if the
 * account is already marked.
 */
export function flagCheater(
  enrolmentId: string,
  input: FlagCheaterInput = {},
): Promise<GameEnrolment> {
  return apiFetch(`${ADMIN}/enrolments/${id(enrolmentId)}/flag-cheater`, {
    method: "POST",
    body: input,
  });
}

/** The one way back to player. Restores what was zeroed unless told not to. */
export function reinstate(
  enrolmentId: string,
  input: ReinstateInput = {},
): Promise<GameEnrolment> {
  return apiFetch(`${ADMIN}/enrolments/${id(enrolmentId)}/reinstate`, {
    method: "POST",
    body: input,
  });
}

/** Every point of Nerve this enrolment gained or lost, newest first. */
export function getScoreLedger(
  enrolmentId: string,
  limit?: number,
): Promise<{ ledger: ScoreLedgerRow[] }> {
  return apiFetch(`${ADMIN}/enrolments/${id(enrolmentId)}/score-ledger`, {
    query: { limit },
  });
}

/**
 * A correction to one player's score, on the record. Floors at zero; the
 * result carries what actually moved.
 */
export function adjustScore(
  enrolmentId: string,
  input: AdjustScoreInput,
): Promise<AdjustScoreResult> {
  return apiFetch(`${ADMIN}/enrolments/${id(enrolmentId)}/score`, {
    method: "POST",
    body: input,
  });
}

// ------------------------------------------------------------ discipline --

/** Both nightly sweeps, now. Returns who each one moved. */
export function runSweeps(): Promise<SweepsResult> {
  return apiFetch(`${ADMIN}/discipline/run`, { method: "POST" });
}

/** Resolves every vote whose window has closed, now. */
export function resolveVotes(): Promise<ResolveVotesResult> {
  return apiFetch(`${ADMIN}/votes/resolve`, { method: "POST" });
}

// ----------------------------------------------------------------- shop --

export function listShopItems(params?: {
  status?: GameShopItem["status"];
}): Promise<{ items: GameShopItem[] }> {
  return apiFetch(`${ADMIN}/shop/items`, { query: { ...params } });
}

export function createShopItem(
  input: CreateShopItemInput,
): Promise<GameShopItem> {
  return apiFetch(`${ADMIN}/shop/items`, { method: "POST", body: input });
}

export function updateShopItem(
  itemId: string,
  input: UpdateShopItemInput,
): Promise<GameShopItem> {
  return apiFetch(`${ADMIN}/shop/items/${id(itemId)}`, {
    method: "PATCH",
    body: input,
  });
}

export function listPurchases(
  params?: ListPurchasesParams,
): Promise<{ purchases: GamePurchase[] }> {
  return apiFetch(`${ADMIN}/shop/purchases`, { query: { ...params } });
}

/** `fulfilled` hands it over; `cancelled` returns the coins and the stock. */
export function setPurchaseStatus(
  purchaseId: string,
  input: SetPurchaseStatusInput,
): Promise<GamePurchase> {
  return apiFetch(`${ADMIN}/shop/purchases/${id(purchaseId)}`, {
    method: "PATCH",
    body: input,
  });
}

// ---------------------------------------------------------------- tasks --

/** The pool. Filter by status for the draft queue or the live set. */
export function listTemplates(
  params?: ListTemplatesParams,
): Promise<{ templates: GameTaskTemplate[] }> {
  return apiFetch(`${ADMIN}/tasks`, { query: { ...params } });
}

/**
 * Two agents write a batch: the creator drafts, the screen and the reviewer
 * refuse, refusals go back for a different task. Survivors are filed as
 * drafts; nothing is published. Slow — a batch is several model calls.
 */
export function generateTasks(
  input: GenerateTasksInput,
): Promise<GenerateTasksResult> {
  return apiFetch(`${ADMIN}/tasks/generate`, { method: "POST", body: input });
}

/** Runs the reviewer on one stored task and keeps the verdict on the row. */
export function reviewTemplate(templateId: string): Promise<GameTaskTemplate> {
  return apiFetch(`${ADMIN}/tasks/${id(templateId)}/review`, {
    method: "POST",
  });
}

/** Draft into the pool. Re-screened here; a rejected review blocks it. */
export function approveTemplate(templateId: string): Promise<GameTaskTemplate> {
  return apiFetch(`${ADMIN}/tasks/${id(templateId)}/approve`, {
    method: "POST",
  });
}

/** Retired, never deleted — a handed-in attempt keeps its meaning. */
export function retireTemplate(templateId: string): Promise<GameTaskTemplate> {
  return apiFetch(`${ADMIN}/tasks/${id(templateId)}/retire`, {
    method: "POST",
  });
}

/** How the Charter in force is doing: generated, rejected, and by what. */
export function getCharterStats(): Promise<PoolStats> {
  return apiFetch(`${ADMIN}/tasks/charter-stats`);
}

// -------------------------------------------------------------- reports --

const REPORTS = `${ADMIN}/reports`;

export function getReportStats(): Promise<ReportStats> {
  return apiFetch(`${REPORTS}/stats`);
}

export function listReports(
  params?: ListReportsParams,
): Promise<{ items: AdminReportView[]; total: number }> {
  return apiFetch(REPORTS, { query: { ...params } });
}

/** One report with its target's state, its siblings and both parties' records. */
export function getReport(reportId: string): Promise<ReportDetail> {
  return apiFetch(`${REPORTS}/${id(reportId)}`);
}

/** Takes it. `force` takes it off whoever holds it. */
export function claimReport(
  reportId: string,
  force = false,
): Promise<{ report: AdminReportView }> {
  return apiFetch(`${REPORTS}/${id(reportId)}/claim`, {
    method: "POST",
    body: { force },
  });
}

export function setReportPriority(
  reportId: string,
  priority: ReportPriority,
): Promise<{ report: AdminReportView }> {
  return apiFetch(`${REPORTS}/${id(reportId)}/priority`, {
    method: "PATCH",
    body: { priority },
  });
}

/**
 * Closes it as resolved or dismissed, optionally acting on the target in the
 * same call — remove, restore, warn, flag, reinstate, retire, archive.
 */
export function resolveReport(
  reportId: string,
  input: ResolveReportInput,
): Promise<ResolveReportResult> {
  return apiFetch(`${REPORTS}/${id(reportId)}/resolve`, {
    method: "POST",
    body: input,
  });
}

export function reopenReport(
  reportId: string,
): Promise<{ report: AdminReportView }> {
  return apiFetch(`${REPORTS}/${id(reportId)}/reopen`, { method: "POST" });
}
