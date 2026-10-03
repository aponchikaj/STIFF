/**
 * Every shape the game API returns, and every union it validates against.
 *
 * Transcribed from `backend/src/game/` — the entity `as const` arrays and the
 * exported service interfaces. Kept as literal unions rather than `string`
 * so that a status the backend stopped sending becomes a type error here
 * instead of a dead branch nobody notices.
 *
 * Source map, if one of these drifts:
 *   unions            → backend/src/game/entities/*.entity.ts
 *   view shapes       → the `export interface …View` in each service
 *   rule numbers      → backend/src/game/rules.ts, media-rules.ts
 *   report catalogue  → backend/src/game/reports/report-rules.ts
 */

/* ======================================================= shared / account */

export type UserRole = "user" | "admin";

/** `toSafeUser()` — the only user shape that ever leaves the backend. */
export interface SafeUser {
  id: string;
  username: string;
  email: string | null;
  role: UserRole;
  isVerified: boolean;
  birthDate: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: SafeUser;
}

/* ================================================================ season */

export const SEASON_STATUSES = ["draft", "open", "running", "closed"] as const;
export type SeasonStatus = (typeof SEASON_STATUSES)[number];

export interface Season {
  id: string;
  slug: string;
  title: string;
  status: SeasonStatus;
  /**
   * Both nullable, and routinely are. A draft season has neither, and a
   * running one may have a start but no announced end — the local test
   * season is exactly that. Never render these without a null branch.
   */
  startsAt: string | null;
  endsAt: string | null;
  /**
   * The server's clock when it answered. Countdowns offset from this, so a
   * phone set five minutes fast still unlocks 001 on the right second.
   */
  now?: string;
  /** Each opal's window and state as the server saw it. Empty with no start. */
  opals?: OpalWindowView[];
}

export type OpalState = "locked" | "open" | "closed";

/** One opal: 001, 002 or 003, one per season day. */
export interface OpalWindowView {
  day: SeasonDay;
  opensAt: string;
  closesAt: string;
  state: OpalState;
}

/** A season runs three days. The ladder is three rungs — spec §04. */
export const SEASON_DAYS = [1, 2, 3] as const;
export type SeasonDay = (typeof SEASON_DAYS)[number];

/** `GET /game/rules` — the numbers a client must state up front. */
export interface GameRules {
  minimumAge: number;
  dailyMinimumTasks: number;
  startingHearts: number;
  heartCosts: string[];
  clanSize: number;
  /** The board ranks and never cuts: no rank ends anyone's season. */
  eliminationByRank: boolean;
  tieBreak: string;
  teamPenaltyCoins: { min: number; max: number };
  voting: {
    windowHours: number;
    rewardCoins: { min: number; max: number };
    cooldownHours: number;
  };
}

/* ============================================================= enrolment */

export const ENROLMENT_ROLES = ["player", "watcher"] as const;
export type EnrolmentRole = (typeof ENROLMENT_ROLES)[number];

export const ENROLMENT_STATUSES = ["active", "demoted", "cheater"] as const;
export type EnrolmentStatus = (typeof ENROLMENT_STATUSES)[number];

export const DEMOTION_REASONS = [
  "cheating",
  "missed_daily_minimum",
  "zero_balance",
  "out_of_hearts",
] as const;
export type DemotionReason = (typeof DEMOTION_REASONS)[number];

export interface EnrolmentView {
  id: string;
  seasonId: string;
  seasonTitle: string;
  role: EnrolmentRole;
  /** `active`, or why they are a watcher now. */
  status: EnrolmentStatus;
  demotionReason: DemotionReason | null;
  demotedAt: string | null;
  handle: string;
  heartsRemaining: number;
  heartsTotal: number;
  nerve: number;
  coins: number;
}

/** The only reason a side can be taken without an enrolment coming back. */
export type PendingReason = "no_season";

export interface RoleChoice {
  /** The enrolment when a season took them; null when it was only kept. */
  enrolment: EnrolmentView | null;
  /** What they chose, either way. */
  role: EnrolmentRole;
  pending: PendingReason | null;
}

/** `POST /game/register` — sign-up, side and session in one response. */
export interface GameRegisterResult extends RoleChoice, AuthTokens {
  user: SafeUser;
}

/** `GET /game/me` — everything the dashboard renders, in one call. */
export interface Dashboard {
  user: SafeUser;
  season: Season | null;
  enrolment: EnrolmentView | null;
  /** Their place on the board; null when they are not on it. */
  rank: number | null;
  /** The count the nightly sweep will make. Null for a watcher. */
  today: { handedIn: number; minimum: number } | null;
  clan: ClanView | null;
  /** A side kept from a choice made before a season existed. */
  rememberedRole: EnrolmentRole | null;
}

/* ================================================================= tasks */

export const TASK_MODES = ["solo", "team"] as const;
export type TaskMode = (typeof TASK_MODES)[number];

export const TASK_PROOFS = ["photo", "video", "either"] as const;
/** How a task is proved: a still, a clip, or the player's choice. */
export type TaskProof = (typeof TASK_PROOFS)[number];

export const TEMPLATE_STATUSES = ["draft", "approved", "retired"] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

/**
 * One thing the watchers check a hand-in for. `assert` is the sentence they
 * judge ("A plant is in frame"); `modality` says whether it is seen or heard;
 * a criterion that is not `required` can be missed without failing.
 */
export interface TemplateCriterion {
  id?: string;
  assert?: string;
  modality?: "visual" | "audio" | string;
  required?: boolean;
  /** Older templates named the sentence `label`. */
  label?: string;
  [key: string]: unknown;
}

export interface PlayableTask {
  id: string;
  slug: string;
  tier: number;
  title: string;
  brief: string;
  proof: TaskProof;
  mode: TaskMode;
  rewardNerve: number;
  rewardCoins: number;
  penaltyCoins: number;
  clockMinutes: number;
  guards: string[];
  criteria: TemplateCriterion[];
}

/* =========================================================== assignments */

export const ASSIGNMENT_STATUSES = [
  "offered",
  "accepted",
  "declined",
  "submitted",
  "expired",
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export interface AssignmentView {
  id: string;
  status: AssignmentStatus;
  /** Set for a clan's task. Held by the leader; both members are paid. */
  clanId: string | null;
  day: SeasonDay;
  task: PlayableTask;
  clockMinutes: number;
  acceptedAt: string | null;
  expiresAt: string | null;
  /** Whole seconds until 00:00; null unless the clock is running. */
  secondsLeft: number | null;
  heartBurned: boolean;
  attemptId: string | null;
}

export interface DeclineOutcome {
  assignment: AssignmentView;
  heartsRemaining: number;
  /** True when that was the last heart — they are a watcher now. */
  demoted: boolean;
}

/* ============================================================== attempts */

export const ATTEMPT_KINDS = ["photo", "video"] as const;
export type AttemptKind = (typeof ATTEMPT_KINDS)[number];

export const ATTEMPT_STATUSES = [
  "awaiting_upload",
  "submitted",
  "published",
  "rejected",
] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const VOTING_STATUSES = [
  "none",
  "open",
  "resolving",
  "deferred",
  "resolved",
] as const;
export type VotingStatus = (typeof VOTING_STATUSES)[number];

/** `POST /game/attempts/upload-url` — step one of the two-step hand-in. */
export interface UploadTicket {
  attemptId: string;
  uploadUrl: string;
  /** Send exactly this — it is signed into the URL. */
  contentType: string;
  expiresAt: string;
}

export interface AttemptView {
  id: string;
  day: SeasonDay;
  kind: AttemptKind;
  status: AttemptStatus;
  mediaUrl: string | null;
  caption: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  votingStatus: VotingStatus;
  createdAt: string;
  publishedAt: string | null;
}

/* ================================================================== feed */

export interface FeedItem {
  id: string;
  day: SeasonDay;
  kind: AttemptKind;
  mediaUrl: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  player: { handle: string; nerve: number; status: EnrolmentStatus };
  likeCount: number;
  commentCount: number;
  shareCount: number;
  /**
   * Null for anonymous readers. Not `false` — false would be a claim about
   * someone who does not exist. Render the heart as unknown, not as unliked.
   */
  likedByMe: boolean | null;
  publishedAt: string;
  /** What the share sheet turns into a story card. */
  shareUrl: string;
  /**
   * The task this is proof of — what a viewer is watching, and what a voter
   * judges it against. Null when it was handed in against no task. Optional
   * so an API that predates it still type-checks as "no task".
   */
  task?: FeedTask | null;
}

/** The public face of a task, as `GET /game/feed` sends it. */
export interface FeedTask {
  title: string;
  brief: string;
  mode: TaskMode;
  proof: TaskProof;
  rewardNerve: number;
  rewardCoins: number;
  /** What the watchers check, as the sentences they judge. */
  criteria: string[];
}

export interface FeedPage {
  items: FeedItem[];
  /** Opaque. Pass back as `cursor`; null at the end. */
  nextCursor: string | null;
}

export interface CommentView {
  id: string;
  body: string;
  authorHandle: string;
  /**
   * Read at render time, not snapshotted: once an account is marked a
   * cheater, every comment it ever wrote says so. Null for someone who
   * never enrolled.
   */
  authorStatus: EnrolmentStatus | null;
  /** `CHEATER WROTE A COMMENT` when the author is one; otherwise null. */
  notice: string | null;
  isMine: boolean;
  createdAt: string;
}

export interface LikeOutcome {
  liked: boolean;
  likeCount: number;
}

export interface ShareOutcome {
  shareCount: number;
}

/* ========================================================= leaderboard */

export interface BoardRow {
  rank: number;
  handle: string;
  nerve: number;
  coins: number;
  heartsRemaining: number;
  heartsTotal: number;
}

export interface Board {
  rows: BoardRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Standing {
  onBoard: boolean;
  rank: number | null;
  total: number;
  handle: string;
  nerve: number;
  coins: number;
  heartsRemaining: number;
  heartsTotal: number;
  status: EnrolmentStatus;
  demotionReason: DemotionReason | null;
  /** The rows either side of them, this one included, in board order. */
  around: BoardRow[];
}

export interface PlayerSearchResult {
  handle: string;
  nerve: number;
  rank: number | null;
  status: EnrolmentStatus;
}

/* ================================================================= clans */

export const CLAN_STATUSES = ["forming", "full", "disbanded"] as const;
export type ClanStatus = (typeof CLAN_STATUSES)[number];

export const CLAN_ROLES = ["leader", "member"] as const;
export type ClanRole = (typeof CLAN_ROLES)[number];

export interface ClanMemberView {
  enrolmentId: string;
  handle: string;
  role: ClanRole;
  nerve: number;
  coins: number;
  heartsRemaining: number;
}

export interface ClanView {
  id: string;
  name: string;
  status: ClanStatus;
  size: number;
  members: ClanMemberView[];
  /** Only handed to the clan's own members, and only while forming. */
  inviteCode: string | null;
  /** The reader's own role, or null for an outsider. */
  myRole: ClanRole | null;
  createdAt: string;
}

export interface LeaveClanOutcome {
  left: boolean;
  /** The leader leaving disbands it. */
  disbanded: boolean;
}

/* ================================================================ voting */

export const VOTE_VALUES = ["yes", "no"] as const;
export type VoteValue = (typeof VOTE_VALUES)[number];

export interface VotableItem {
  id: string;
  day: number;
  kind: string;
  mediaUrl: string | null;
  caption: string | null;
  player: { handle: string };
  task: { title: string; brief: string; proof: string } | null;
  votingEndsAt: string;
  secondsLeft: number;
  yes: number;
  no: number;
  myVote: VoteValue | null;
}

export interface VoteOutcome {
  attemptId: string;
  vote: VoteValue;
  yes: number;
  no: number;
  /** Seconds until this watcher can earn from a vote again; 0 if now. */
  cooldownSecondsLeft: number;
}

/* ================================================================== shop */

export const SHOP_ITEM_STATUSES = ["draft", "live", "archived"] as const;
export type ShopItemStatus = (typeof SHOP_ITEM_STATUSES)[number];

export const PURCHASE_STATUSES = ["paid", "fulfilled", "cancelled"] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export interface ShopItemView {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCoins: number;
  /** Null is unlimited. */
  stock: number | null;
  perPersonLimit: number | null;
  /** How many the reader has bought; 0 for a signed-out reader. */
  bought: number;
  soldOut: boolean;
}

export interface PurchaseView {
  id: string;
  itemId: string;
  itemName: string;
  priceCoins: number;
  status: PurchaseStatus;
  note: string | null;
  createdAt: string;
}

/* ================================================================= opals */

export const OPAL_PAYMENT_METHODS = ["card_tbc", "card_bog"] as const;
export type OpalPaymentMethod = (typeof OPAL_PAYMENT_METHODS)[number];

export const OPAL_ORDER_STATUSES = ["pending", "paid", "failed"] as const;
export type OpalOrderStatus = (typeof OPAL_ORDER_STATUSES)[number];

/** A pack on the price list. `priceCents` is tetri: 500 is 5.00 GEL. */
export interface OpalPackView {
  id: string;
  name: string;
  opals: number;
  priceCents: number;
  badge: string | null;
}

/** One card method, and whether it can take money right now. */
export interface OpalMethodView {
  method: OpalPaymentMethod;
  label: string;
  note: string;
  available: boolean;
  /** True when no real money moves — say so on the screen. */
  testMode: boolean;
}

export interface OpalOrderView {
  id: string;
  packName: string;
  opals: number;
  priceCents: number;
  paymentMethod: OpalPaymentMethod;
  status: OpalOrderStatus;
  testMode: boolean;
  createdAt: string;
  paidAt: string | null;
}

export type OpalCheckoutNext = { kind: "paid" } | { kind: "redirect"; url: string };

export interface OpalCheckoutResult {
  order: OpalOrderView;
  next: OpalCheckoutNext;
  /** The balance after, when already known. */
  coins: number | null;
}

/* ============================================================= clan wars */

export const WAR_STATUSES = [
  "proposed",
  "accepted",
  "live",
  "judging",
  "finished",
  "declined",
  "withdrawn",
  "void",
] as const;
export type WarStatus = (typeof WAR_STATUSES)[number];

export const WAR_OUTCOMES = ["challenger", "opponent", "draw", "void"] as const;
export type WarOutcome = (typeof WAR_OUTCOMES)[number];

export const WAR_SETTLEMENT_REASONS = [
  "paid",
  "draw",
  "one_sided",
  "no_bets",
  "void",
] as const;
export type WarSettlementReason = (typeof WAR_SETTLEMENT_REASONS)[number];

export type WarSide = "challenger" | "opponent";

export interface WarView {
  id: string;
  status: WarStatus;
  challenger: { clanId: string; name: string; score: number };
  opponent: { clanId: string; name: string; score: number };
  startsAt: string;
  endsAt: string;
  /** True while a bet can still be placed. */
  bookOpen: boolean;
  pools: Record<WarSide, number>;
  bettors: number;
  /**
   * What one coin on each side returns if the war ended now, rake taken.
   * Null for a side nobody has backed — the honest answer there is
   * "your stake back", and a number would imply otherwise.
   */
  returnPerCoin: Record<WarSide, number | null>;
  rakePercent: number;
  outcome: WarOutcome | null;
  winnerClanId: string | null;
  settlementReason: string | null;
  voidReason: string | null;
  settledAt: string | null;
  /** The reader's own bet, if they have one. */
  myBet: { side: WarSide; stake: number; payout: number; settled: boolean } | null;
  /** Whether the reader may bet, and why not. */
  canBet: { allowed: boolean; reason: string | null };
}

export type WarFilter = "open" | "live" | "finished" | "mine" | "all";

/* =============================================================== reports */

export const REPORT_TARGET_TYPES = [
  "attempt",
  "comment",
  "user",
  "task",
  "shop_item",
  "clan",
  "purchase",
  /** The game itself: a bug, or a way to cheat it. No target id. */
  "app",
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_STATUSES = [
  "open",
  "reviewing",
  "resolved",
  "dismissed",
  "withdrawn",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export type ReportPriority = 0 | 1 | 2 | 3;

export interface ReportReasonOption {
  id: string;
  label: string;
  applies?: readonly ReportTargetType[];
}

/** `GET /game/reports/reasons` — what the report sheet renders. */
export interface ReportCatalogue {
  targetTypes: {
    type: ReportTargetType;
    label: string;
    reasons: ReportReasonOption[];
  }[];
  tags: { id: string; label: string }[];
  dailyCap: number;
  autoHideThreshold: number;
}

export interface ReportView {
  id: string;
  targetType: ReportTargetType;
  targetId: string | null;
  /** Enough of the snapshot to recognise it: a handle, a title, a caption. */
  about: string;
  reason: string;
  reasonLabel: string;
  details: string | null;
  tags: string[];
  status: ReportStatus;
  /** `action_taken` / `no_action` once closed; null while on the queue. */
  outcome: "action_taken" | "no_action" | null;
  reporterMessage: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

/* ========================================================= notifications */

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/* =================================================== request body shapes */

export interface GameRegisterInput {
  username: string;
  password: string;
  role: EnrolmentRole;
  /** `YYYY-MM-DD`. Checked before the account is made — the game is 16+. */
  birthDate: string;
  /** Optional. Someone who gives one gets the verification mail. */
  email?: string;
}

export interface EnrolInput {
  role: EnrolmentRole;
  /** Required the first time a shop account takes a side — it was never asked. */
  birthDate?: string;
}

export interface RequestUploadInput {
  assignmentId: string;
  kind: AttemptKind;
  mimeType: string;
  byteSize: number;
  /** Required for a clip, absent for a still. */
  durationSeconds?: number;
}

export interface ConfirmAttemptInput {
  byteSize: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  caption?: string;
}

export interface FeedQuery {
  cursor?: string;
  limit?: number;
  day?: SeasonDay;
  /** A handle: only that player's posts (their profile). */
  player?: string;
}

export interface LeaderboardQuery {
  page?: number;
  pageSize?: number;
}

export interface PlayableTasksQuery {
  tier?: 1 | 2 | 3;
  mode?: TaskMode;
}

export interface ProposeWarInput {
  opponentClanId: string;
  /** ISO. 30 min – 7 days out; an hour from now when omitted. */
  startsAt?: string;
}

export interface PlaceBetInput {
  side: WarSide;
  coins: number;
}

export interface CreateReportInput {
  targetType: ReportTargetType;
  targetId?: string;
  /** For `user` only: the handle shown on the feed or the board. */
  handle?: string;
  reason: string;
  details?: string;
  tags?: string[];
  /** Where in the app: a path or a screen name. */
  context?: string;
}
