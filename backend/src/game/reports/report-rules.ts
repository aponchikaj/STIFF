import { BLOCKED_TASK_TYPES } from '../ai/blocklist';

/**
 * What can be reported, why, and what happens next — in one place.
 *
 * Pure constants and pure functions, like `rules.ts`: no Nest, no database.
 * The catalogue below is rendered straight to the client
 * (`GET /api/game/reports/reasons`) so the report sheet on every screen
 * offers exactly the reasons the server will accept for that thing, and
 * nothing here is a string the service also hard-codes somewhere else.
 */

// ---------------------------------------------------------------- targets --

export const REPORT_TARGET_TYPES = [
  /** A published hand-in in the feed — a photo or a clip. */
  'attempt',
  /** A comment under one. */
  'comment',
  /** A person: a player or a watcher, by id or by handle. */
  'user',
  /** A task brief from the pool. */
  'task',
  /** Something the coin shop sells. */
  'shop_item',
  /** A clan — its name, mostly. */
  'clan',
  /** One's own purchase: paid for and not delivered, or delivered wrong. */
  'purchase',
  /** The game itself: a bug, or a way to cheat it. No target id. */
  'app',
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_TARGET_LABELS: Record<ReportTargetType, string> = {
  attempt: 'A hand-in',
  comment: 'A comment',
  user: 'A person',
  task: 'A task',
  shop_item: 'A shop item',
  clan: 'A clan',
  purchase: 'My purchase',
  app: 'The game',
};

// ---------------------------------------------------------------- reasons --

/**
 * 0 low · 1 normal · 2 high · 3 critical. Critical is anything where a
 * person may be at risk right now, or where the game itself is being
 * gamed; the queue is sorted on it before age.
 */
export type ReportPriority = 0 | 1 | 2 | 3;

export interface ReportReason {
  id: string;
  label: string;
  priority: ReportPriority;
  /**
   * `self` — only on one's own thing (an appeal).
   * `others` — only on somebody else's.
   * `any` — either.
   */
  applies: 'self' | 'others' | 'any';
}

const R = (
  id: string,
  label: string,
  priority: ReportPriority,
  applies: ReportReason['applies'] = 'others',
): ReportReason => ({ id, label, priority, applies });

/** Every reason the game knows, whatever it is about. */
export const REPORT_REASONS: readonly ReportReason[] = [
  // Safety — a person may be at risk.
  R('self_harm', 'Self-harm', 3),
  R('violence', 'Violence or a threat', 3),
  R('threat', 'A threat', 3),
  R('illegal', 'Illegal activity', 3),
  R('minor_in_frame', 'Someone under 16 in frame', 3),
  R('underage', 'This person is under 16', 3),
  R('exploit', 'A way to cheat the game', 3, 'any'),

  // Conduct.
  R('harassment', 'Harassment or bullying', 2),
  R('hate', 'Hate or discrimination', 2),
  R('sexual', 'Sexual content', 2),
  R('dangerous', 'Dangerous behaviour', 2, 'any'),
  R('privacy', 'Private details, or filmed without consent', 2),
  R('impersonation', 'Pretending to be someone else', 2),
  R('scam', 'A scam', 2, 'any'),

  // The competition.
  R('cheating', 'Cheating — faked, staged, AI-made or reused footage', 2),
  R('multiple_accounts', 'More than one account', 2),
  R('vote_manipulation', 'Buying or organising votes', 2),
  R('not_the_task', 'Does not do the task', 1),
  R('copyright', 'Someone else’s footage', 1),
  R('wrong_verdict', 'The verdict on my hand-in is wrong', 1, 'self'),
  R('unfair_demotion', 'I was moved to watcher unfairly', 1, 'self'),

  // Content that is merely bad.
  R('spam', 'Spam or advertising', 1),
  R('offensive', 'Offensive', 1, 'any'),
  R('offensive_name', 'Offensive name', 1, 'any'),
  R('off_topic', 'Off topic', 0),

  // The task pool.
  R('impossible', 'Cannot be done as written', 1, 'any'),
  R('unclear', 'Unclear', 0, 'any'),
  R('duplicate', 'Same as another task', 0, 'any'),
  R('unfair_reward', 'Pays or costs the wrong amount', 0, 'any'),

  // The shop.
  R('misleading', 'Not what it says it is', 1, 'any'),
  R('wrong_price', 'The price looks wrong', 0, 'any'),
  R('broken_image', 'The picture is broken', 0, 'any'),
  R('not_delivered', 'Paid, never received', 1, 'self'),
  R('wrong_item', 'Received the wrong thing', 1, 'self'),
  R('charged_wrongly', 'Charged the wrong amount', 1, 'self'),

  // The game.
  R('bug', 'Something is broken', 1, 'any'),

  R('other', 'Something else', 0, 'any'),
];

const REASON_BY_ID: ReadonlyMap<string, ReportReason> = new Map(
  REPORT_REASONS.map((r) => [r.id, r]),
);

/** Which reasons each kind of thing can be reported for, in menu order. */
export const REASONS_FOR_TARGET: Record<ReportTargetType, readonly string[]> = {
  attempt: [
    'cheating',
    'not_the_task',
    'dangerous',
    'illegal',
    'violence',
    'self_harm',
    'sexual',
    'minor_in_frame',
    'privacy',
    'hate',
    'harassment',
    'copyright',
    'spam',
    'wrong_verdict',
    'other',
  ],
  comment: [
    'spam',
    'harassment',
    'hate',
    'sexual',
    'threat',
    'privacy',
    'off_topic',
    'other',
  ],
  user: [
    'cheating',
    'harassment',
    'impersonation',
    'underage',
    'multiple_accounts',
    'vote_manipulation',
    'spam',
    'hate',
    'unfair_demotion',
    'other',
  ],
  task: [
    'dangerous',
    'illegal',
    'impossible',
    'unclear',
    'offensive',
    'duplicate',
    'unfair_reward',
    'other',
  ],
  shop_item: [
    'misleading',
    'wrong_price',
    'offensive',
    'scam',
    'broken_image',
    'other',
  ],
  clan: ['offensive_name', 'impersonation', 'cheating', 'other'],
  purchase: ['not_delivered', 'wrong_item', 'charged_wrongly', 'other'],
  app: ['bug', 'exploit', 'other'],
};

export function reasonFor(id: string): ReportReason | null {
  return REASON_BY_ID.get(id) ?? null;
}

export function isReasonFor(targetType: ReportTargetType, id: string): boolean {
  return REASONS_FOR_TARGET[targetType].includes(id);
}

export function reasonsFor(targetType: ReportTargetType): ReportReason[] {
  return REASONS_FOR_TARGET[targetType].map((id) => {
    const reason = REASON_BY_ID.get(id);
    if (!reason) throw new Error(`Unknown report reason "${id}"`);
    return reason;
  });
}

/**
 * Whether this reason may be used on one's own thing, on somebody else's,
 * or both — the same answer whichever screen asks.
 */
export function reasonAllowed(
  targetType: ReportTargetType,
  id: string,
  own: boolean,
): boolean {
  const reason = REASON_BY_ID.get(id);
  if (!reason || !isReasonFor(targetType, id)) return false;
  if (reason.applies === 'any') return true;
  return own ? reason.applies === 'self' : reason.applies === 'others';
}

export function priorityFor(reasonId: string): ReportPriority {
  return REASON_BY_ID.get(reasonId)?.priority ?? 1;
}

// ------------------------------------------------------------------- tags --

/**
 * A `dangerous` or `illegal` report on a hand-in or a task can say which
 * kind — the same ids the task pipeline's blocklist uses, so "weapons"
 * means the same thing to a reporter, the reviewer agent and the Charter.
 */
export const REPORT_TAGS: readonly { id: string; label: string }[] =
  BLOCKED_TASK_TYPES.map((t) => ({ id: t.id, label: t.label }));

const TAG_IDS = new Set(REPORT_TAGS.map((t) => t.id));

export const MAX_REPORT_TAGS = 6;

/** Keeps the known tags, in order, once each, at most `MAX_REPORT_TAGS`. */
export function normaliseTags(tags: readonly string[] | undefined): string[] {
  if (!tags) return [];
  const out: string[] = [];
  for (const raw of tags) {
    const id = String(raw).trim().toLowerCase();
    if (TAG_IDS.has(id) && !out.includes(id)) out.push(id);
    if (out.length >= MAX_REPORT_TAGS) break;
  }
  return out;
}

// --------------------------------------------------------------- statuses --

export const REPORT_STATUSES = [
  /** Filed, nobody has looked. */
  'open',
  /** An admin claimed it. */
  'reviewing',
  /** Looked at; `action` says what was done, which may be nothing. */
  'resolved',
  /** Looked at and found not to be a problem. */
  'dismissed',
  /** The reporter took it back before anyone looked. */
  'withdrawn',
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** The statuses that count as "still on the queue". */
export const OPEN_STATUSES: readonly ReportStatus[] = ['open', 'reviewing'];

/** The statuses an admin may close a report as. */
export const CLOSING_STATUSES = ['resolved', 'dismissed'] as const;
export type ClosingStatus = (typeof CLOSING_STATUSES)[number];

// ---------------------------------------------------------------- actions --

/**
 * What resolving a report can do, each one a call into the service that
 * already owns that consequence — nothing here is a second implementation
 * of "unpublish an attempt" or "flag a cheater".
 */
export const REPORT_ACTIONS = [
  /** Looked at, nothing changed. The default. */
  'none',
  /** Comment deleted, or hand-in taken out of the feed. */
  'remove_content',
  /** An auto-hidden hand-in or comment put back. */
  'restore_content',
  /** The person it is about is told, with the note. */
  'warn_user',
  /** `DisciplineService.flagCheater` on the person it is about. */
  'flag_cheater',
  /** `DisciplineService.reinstate` — an upheld appeal. */
  'reinstate',
  /** `TaskTemplatesService.retire` on the task. */
  'retire_task',
  /** The shop item archived. */
  'archive_item',
] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

/** Which actions make sense for which kind of thing. */
export const ACTIONS_FOR_TARGET: Record<
  ReportTargetType,
  readonly ReportAction[]
> = {
  attempt: [
    'none',
    'remove_content',
    'restore_content',
    'warn_user',
    'flag_cheater',
  ],
  comment: ['none', 'remove_content', 'restore_content', 'warn_user'],
  user: ['none', 'warn_user', 'flag_cheater', 'reinstate'],
  task: ['none', 'retire_task'],
  shop_item: ['none', 'archive_item'],
  clan: ['none', 'warn_user', 'flag_cheater'],
  purchase: ['none', 'warn_user'],
  app: ['none'],
};

export function actionAllowed(
  targetType: ReportTargetType,
  action: ReportAction,
): boolean {
  return ACTIONS_FOR_TARGET[targetType].includes(action);
}

/** Actions the person reported should be told about. */
export const ACTIONS_THAT_NOTIFY_TARGET: readonly ReportAction[] = [
  'warn_user',
  'remove_content',
  'flag_cheater',
  'reinstate',
];

// ------------------------------------------------------------- thresholds --

interface EnvReader {
  get<T = string>(key: string): T | undefined;
}

/**
 * How many different people must have an open report on the same hand-in
 * or comment before it is hidden from the feed without waiting for an
 * admin. Zero disables it. `GAME_REPORT_AUTO_HIDE`.
 */
export const DEFAULT_AUTO_HIDE_THRESHOLD = 5;

export function autoHideThreshold(env?: EnvReader): number {
  const raw = env?.get<string>('GAME_REPORT_AUTO_HIDE');
  const parsed = raw === undefined ? NaN : Number.parseInt(String(raw), 10);
  return Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_AUTO_HIDE_THRESHOLD;
}

/**
 * How many reports one account may file in a rolling day. The throttle on
 * the route stops a script; this stops a grudge. `GAME_REPORT_DAILY_CAP`.
 */
export const DEFAULT_REPORT_DAILY_CAP = 20;

export function reportDailyCap(env?: EnvReader): number {
  const raw = env?.get<string>('GAME_REPORT_DAILY_CAP');
  const parsed = raw === undefined ? NaN : Number.parseInt(String(raw), 10);
  return Number.isInteger(parsed) && parsed >= 1
    ? parsed
    : DEFAULT_REPORT_DAILY_CAP;
}

/** Priority an auto-hidden target's reports are raised to, at least. */
export const ESCALATED_PRIORITY: ReportPriority = 2;

export const MAX_DETAILS_LENGTH = 1000;
export const MAX_CONTEXT_LENGTH = 300;
export const MAX_NOTE_LENGTH = 1000;
export const MAX_REPORTER_MESSAGE_LENGTH = 500;
