// Mirrors of the game backend's response shapes (`backend/src/game`).
// Keep in sync with the entities, DTOs and service views there.

// ---------------------------------------------------------------- unions --

export type SeasonStatus = "draft" | "open" | "running" | "closed";
export type SeasonDay = 1 | 2 | 3;

export type EnrolmentRole = "player" | "watcher";
export type EnrolmentStatus = "active" | "demoted" | "cheater";
export type DemotionReason =
  | "cheating"
  | "missed_daily_minimum"
  | "zero_balance"
  | "out_of_hearts";

export type AttemptStatus =
  | "awaiting_upload"
  | "submitted"
  | "published"
  | "rejected";
export type AttemptKind = "photo" | "video";
export type VotingStatus =
  | "none"
  | "open"
  | "resolving"
  | "deferred"
  | "resolved";
export type CheatVerdictKind =
  | "authentic"
  | "suspicious"
  | "cheating"
  | "unchecked";

export type TemplateStatus = "draft" | "approved" | "retired";
export type TemplateOrigin = "human" | "generated";
export type TaskMode = "solo" | "team";
export type TaskProof = "photo" | "video" | "either";

export type ShopItemStatus = "draft" | "live" | "archived";
export type PurchaseStatus = "paid" | "fulfilled" | "cancelled";

export type ScoreReason =
  | "task_reward"
  | "clawback"
  | "cheating"
  | "reinstated"
  | "admin"
  | "opening";

export type ReportTargetType =
  | "attempt"
  | "comment"
  | "user"
  | "task"
  | "shop_item"
  | "clan"
  | "purchase"
  | "app";
export type ReportStatus =
  | "open"
  | "reviewing"
  | "resolved"
  | "dismissed"
  | "withdrawn";
export type ClosingStatus = "resolved" | "dismissed";
export type ReportPriority = 0 | 1 | 2 | 3;
export type ReportAction =
  | "none"
  | "remove_content"
  | "restore_content"
  | "warn_user"
  | "flag_cheater"
  | "reinstate"
  | "retire_task"
  | "archive_item";

export const SEASON_STATUSES: readonly SeasonStatus[] = [
  "draft",
  "open",
  "running",
  "closed",
];
export const ENROLMENT_STATUSES: readonly EnrolmentStatus[] = [
  "active",
  "demoted",
  "cheater",
];
export const TEMPLATE_STATUSES: readonly TemplateStatus[] = [
  "draft",
  "approved",
  "retired",
];
export const SHOP_ITEM_STATUSES: readonly ShopItemStatus[] = [
  "draft",
  "live",
  "archived",
];
export const PURCHASE_STATUSES: readonly PurchaseStatus[] = [
  "paid",
  "fulfilled",
  "cancelled",
];
export const REPORT_TARGET_TYPES: readonly ReportTargetType[] = [
  "attempt",
  "comment",
  "user",
  "task",
  "shop_item",
  "clan",
  "purchase",
  "app",
];
export const REPORT_STATUSES: readonly ReportStatus[] = [
  "open",
  "reviewing",
  "resolved",
  "dismissed",
  "withdrawn",
];
export const REPORT_ACTIONS: readonly ReportAction[] = [
  "none",
  "remove_content",
  "restore_content",
  "warn_user",
  "flag_cheater",
  "reinstate",
  "retire_task",
  "archive_item",
];

// ---------------------------------------------------------------- season --

export interface GameSeason {
  id: string;
  slug: string;
  title: string;
  status: SeasonStatus;
  startsAt: string | null;
  endsAt: string | null;
  startingHearts: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * What the *public* `GET /game/season` returns — deliberately less than the
 * row. It is the season a signed-out visitor is allowed to know about, so it
 * carries no `startingHearts` and no timestamps beyond the two dates. Typing
 * it as the full entity is how a screen ends up rendering `undefined`.
 */
export type PublicSeason = Pick<
  GameSeason,
  "id" | "slug" | "title" | "status" | "startsAt" | "endsAt"
>;

export interface CreateSeasonInput {
  slug: string;
  title: string;
  startingHearts?: number;
}

/** `GET /game/rules` — the constants the server plays by. */
export interface GameRules {
  minimumAge: number;
  dailyMinimumTasks: number;
  startingHearts: number;
  heartCosts: string[];
  clanSize: number;
  /** Always false: the board ranks, and no position ends anyone's season. */
  eliminationByRank: boolean;
  tieBreak: string;
  teamPenaltyCoins: { min: number; max: number };
  voting: {
    windowHours: number;
    rewardCoins: { min: number; max: number };
    cooldownHours: number;
  };
}

// ------------------------------------------------------------- enrolment --

export interface DemotionSnapshot {
  nerve: number;
  heartsRemaining: number;
  coins?: number;
  attemptId?: string;
  by: string;
}

export interface GameEnrolment {
  id: string;
  seasonId: string;
  userId: string;
  role: EnrolmentRole;
  status: EnrolmentStatus;
  demotedAt: string | null;
  demotionReason: DemotionReason | null;
  demotionSnapshot: DemotionSnapshot | null;
  handle: string;
  heartsRemaining: number;
  heartsTotal: number;
  nerve: number;
  coins: number;
  lastVoteWinAt: string | null;
  lastScoredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListEnrolmentsParams {
  status?: EnrolmentStatus;
  role?: EnrolmentRole;
  limit?: number;
}

export interface ScoreLedgerRow {
  id: string;
  enrolmentId: string;
  delta: number;
  scoreAfter: number;
  reason: ScoreReason;
  refType: string | null;
  refId: string | null;
  by: string | null;
  createdAt: string;
}

export interface AdjustScoreInput {
  /** Non-zero, within ±10,000. */
  delta: number;
  /** 3 to 200 characters; stored with the audit entry. */
  reason: string;
}

export interface AdjustScoreResult {
  enrolmentId: string;
  nerveDelta: number;
  nerve: number;
  reason: string;
}

// ---------------------------------------------------------------- board --

export interface BoardRow {
  rank: number;
  handle: string;
  nerve: number;
  coins: number;
  heartsRemaining: number;
  heartsTotal: number;
  cut: 1 | 2 | 3 | null;
}

export interface Board {
  rows: BoardRow[];
  total: number;
  page: number;
  pageSize: number;
}

// --------------------------------------------------------------- attempt --

export interface CheatVerdict {
  verdict: CheatVerdictKind;
  confidence: number;
  reasons: string[];
  signals?: string[];
  model: string | null;
  checkedAt: string;
  mode: "enforce" | "shadow" | "off";
  enforced: boolean;
  skipped?: "video" | "not_configured" | "no_media" | "error" | "disabled";
}

export interface VotingResolution {
  outcome: "confirmed" | "not_confirmed" | "unsure";
  confidence: number;
  payout: number;
  reasons: string[];
  model: string | null;
  by: string;
  resolvedAt: string;
  yes: number;
  no: number;
  paid: number;
  cooling: number;
}

export interface GameAttempt {
  id: string;
  seasonId: string;
  enrolmentId: string;
  taskTemplateId: string | null;
  assignmentId: string | null;
  day: SeasonDay;
  kind: AttemptKind;
  status: AttemptStatus;
  objectKey: string;
  mediaUrl: string | null;
  mimeType: string;
  byteSize: number;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  submittedAt: string | null;
  aiVerdict: CheatVerdict | null;
  aiCheckedAt: string | null;
  rejectionReason: string | null;
  votingStatus: VotingStatus;
  votingEndsAt: string | null;
  voting: VotingResolution | null;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  publishedAt: string | null;
  hiddenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The review queue joins the player's handle and score onto each attempt. */
export interface ReviewAttempt extends GameAttempt {
  enrolment: Pick<GameEnrolment, "id" | "handle" | "nerve">;
}

export interface ReviewQueue {
  items: ReviewAttempt[];
  total: number;
}

export interface ReviewQueueParams {
  day?: SeasonDay;
  limit?: number;
}

export type Verdict = "approve" | "reject";

export interface SettleInput {
  verdict: Verdict;
  /** Nerve to award on an approval; the template's reward when omitted. */
  nerve?: number;
  /** One-way: burns a heart, and the last one demotes. */
  burnHeart?: boolean;
  reason?: string;
}

export interface FlagCheaterInput {
  attemptId?: string;
  reason?: string;
}

export interface ReinstateInput {
  /** Put the zeroed Nerve, hearts and coins back. Default true. */
  restore?: boolean;
}

// ------------------------------------------------------------ discipline --

export interface Demotion {
  enrolmentId: string;
  userId: string;
  reason: DemotionReason;
}

export interface SweepReport {
  seasonId: string | null;
  window: { start: string; end: string } | null;
  demoted: Demotion[];
  skipped?: string;
}

export interface SweepsResult {
  dailyMinimum: SweepReport;
  zeroBalance: SweepReport;
}

export interface ResolveVotesResult {
  resolved: number;
  deferred: number;
  skipped: number;
}

// ----------------------------------------------------------------- shop --

export interface GameShopItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCoins: number;
  /** Null is unlimited. */
  stock: number | null;
  perPersonLimit: number | null;
  status: ShopItemStatus;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShopItemInput {
  name: string;
  description?: string;
  imageUrl?: string;
  priceCoins: number;
  stock?: number;
  perPersonLimit?: number;
  status?: ShopItemStatus;
  sortOrder?: number;
}

export interface UpdateShopItemInput {
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  priceCoins?: number;
  stock?: number | null;
  perPersonLimit?: number | null;
  status?: ShopItemStatus;
  sortOrder?: number;
}

export interface GamePurchase {
  id: string;
  itemId: string;
  enrolmentId: string;
  userId: string;
  itemName: string;
  priceCoins: number;
  status: PurchaseStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  /** Loaded by the admin listing. */
  enrolment?: Pick<GameEnrolment, "id" | "handle" | "coins" | "userId">;
}

export interface ListPurchasesParams {
  status?: PurchaseStatus;
  itemId?: string;
  limit?: number;
}

export interface SetPurchaseStatusInput {
  status: "fulfilled" | "cancelled";
  note?: string;
}

// ---------------------------------------------------------------- tasks --

export interface TaskReview {
  verdict: Verdict;
  severity: "ok" | "bad" | "illegal";
  blockedTypes: string[];
  reasons: string[];
  feedback: string | null;
  model: string | null;
  reviewedAt: string;
  round: number;
}

export interface TemplateCriterion {
  id: string;
  modality: string;
  required: boolean;
  assert: string;
}

export interface GameTaskTemplate {
  id: string;
  slug: string;
  tier: SeasonDay;
  title: string;
  brief: string;
  clockMinutes: number;
  proof: TaskProof;
  mode: TaskMode;
  rewardNerve: number;
  rewardCoins: number;
  penaltyCoins: number;
  review: TaskReview | null;
  guards: string[];
  criteria: TemplateCriterion[];
  rationale: string | null;
  status: TemplateStatus;
  origin: TemplateOrigin;
  charterHash: string | null;
  model: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListTemplatesParams {
  status?: TemplateStatus;
  tier?: SeasonDay;
}

export interface GenerateTasksInput {
  tier: SeasonDay;
  /** 1 to 20 slots. */
  count: number;
  /** Slugs to steer away from; the live pool is added automatically. */
  avoid?: string[];
  /** Up to 500 characters of direction for the creator. */
  steer?: string;
  mode?: TaskMode;
}

export interface GeneratedTaskDraft {
  slug: string;
  title: string;
  brief: string;
  [key: string]: unknown;
}

export interface PipelineRejection {
  task: GeneratedTaskDraft;
  source: "screen" | "reviewer";
  round: number;
  violations: { id?: string; label?: string; [key: string]: unknown }[];
  feedback: string;
  review?: TaskReview;
}

export interface GenerateTasksResult {
  charterHash: string;
  models: { creator: string | null; reviewer: string | null };
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
  rounds: number;
  maxRounds: number;
  dropped: number;
  saved: GameTaskTemplate[];
  skipped: string[];
  rejected: PipelineRejection[];
  rejectionsStored: number;
}

export interface PoolStats {
  charterHash: string;
  generated: number;
  rejected: number;
  byCategory: Record<string, number>;
}

// -------------------------------------------------------------- reports --

export interface ReportView {
  id: string;
  targetType: ReportTargetType;
  targetId: string | null;
  about: string;
  reason: string;
  reasonLabel: string;
  details: string | null;
  tags: string[];
  status: ReportStatus;
  outcome: "action_taken" | "no_action" | null;
  reporterMessage: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AdminReportView extends ReportView {
  seasonId: string | null;
  reporterId: string | null;
  reporterHandle: string;
  targetUserId: string | null;
  snapshot: Record<string, unknown>;
  context: string | null;
  priority: ReportPriority;
  assignedTo: string | null;
  action: ReportAction | null;
  note: string | null;
  resolvedBy: string | null;
  updatedAt: string;
}

export interface TargetState {
  exists: boolean;
  hidden: boolean;
  status: string | null;
  openReporters: number;
}

export interface PartyStats {
  userId: string;
  filed: number;
  filedUpheld: number;
  filedDismissed: number;
  received: number;
  receivedUpheld: number;
  receivedOpen: number;
}

export interface ReportDetail {
  report: AdminReportView;
  target: TargetState;
  siblings: AdminReportView[];
  targetUser: PartyStats | null;
  reporter: PartyStats | null;
  /** The actions that make sense for this target type. */
  actions: readonly ReportAction[];
}

export interface ReportStats {
  byStatus: Record<ReportStatus, number>;
  openByTargetType: Record<ReportTargetType, number>;
  openByPriority: Record<"0" | "1" | "2" | "3", number>;
  openByReason: { reason: string; count: number }[];
  oldestOpenSeconds: number | null;
  hidden: { attempts: number; comments: number };
  mostReported: {
    targetType: ReportTargetType;
    targetId: string;
    reporters: number;
    about: string;
  }[];
}

export interface ListReportsParams {
  /** `queue` is open + reviewing; `closed` is the rest; `all` is everything. */
  status?: ReportStatus | "queue" | "closed" | "all";
  targetType?: ReportTargetType;
  targetId?: string;
  targetUserId?: string;
  reporterId?: string;
  reason?: string;
  minPriority?: ReportPriority;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}

export interface ResolveReportInput {
  status: ClosingStatus;
  action?: ReportAction;
  note?: string;
  reporterMessage?: string;
  /** Close every other open report on the same target with this one. */
  includeSiblings?: boolean;
  notifyReporter?: boolean;
}

export interface ResolveReportResult {
  report: AdminReportView;
  siblingsClosed: number;
  actionResult: Record<string, unknown> | null;
}
