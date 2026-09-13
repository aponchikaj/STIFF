import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { returnedRows } from '../common/utils/returned-rows';
import { GameAttemptComment } from './entities/game-attempt-comment.entity';
import type { AttemptStatus } from './entities/game-attempt.entity';
import type { AssignmentStatus } from './entities/game-task-assignment.entity';
import { SeasonsService } from './seasons.service';

// -------------------------------------------------------------------- views

export interface ClanMemberRow {
  enrolmentId: string;
  handle: string;
  role: 'leader' | 'member';
  status: string;
  nerve: number;
  coins: number;
  heartsRemaining: number;
  heartsTotal: number;
}

export interface ClanRow {
  id: string;
  name: string;
  status: string;
  inviteCode: string;
  createdAt: string;
  members: ClanMemberRow[];
  /** Combined Nerve of both members. */
  nerve: number;
  /** The war this clan is in that is not over, if any. */
  war: {
    id: string;
    status: string;
    opponent: string;
    startsAt: string;
  } | null;
  warsFought: number;
  warsWon: number;
}

export interface AttemptRow {
  id: string;
  enrolmentId: string;
  handle: string;
  playerStatus: string;
  task: string | null;
  day: number;
  kind: string;
  status: AttemptStatus;
  mediaUrl: string | null;
  caption: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  hiddenAt: string | null;
  rejectionReason: string | null;
  verdict: string | null;
  confidence: number | null;
  votingStatus: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
}

export interface VoteRow {
  attemptId: string;
  handle: string;
  task: string | null;
  day: number;
  kind: string;
  mediaUrl: string | null;
  votingStatus: string;
  votingEndsAt: string | null;
  yes: number;
  no: number;
  /** How the model read it, when it did. */
  verdict: string | null;
}

export interface ClockRow {
  id: string;
  enrolmentId: string;
  handle: string;
  clan: string | null;
  task: string;
  day: number;
  status: AssignmentStatus;
  clockMinutes: number;
  acceptedAt: string | null;
  expiresAt: string | null;
  /** Negative once the clock has passed zero and the sweep has not caught it. */
  secondsLeft: number | null;
  heartBurned: boolean;
  createdAt: string;
}

export interface CommentRow {
  id: string;
  authorHandle: string;
  userId: string;
  body: string;
  hiddenAt: string | null;
  createdAt: string;
}

/**
 * The control room's view of the game — the parts nobody else looks at.
 *
 * Every other admin surface is attached to one job: the review queue, the
 * report queue, the task pool. This is the remainder: the clans as a whole,
 * every hand-in rather than only the ones waiting, the votes still open,
 * the clocks still running. Read-only except for hiding a comment, because
 * each of these already has one implementation of "change it" elsewhere and
 * a second would drift.
 *
 * All of it is scoped to the live season. Between seasons there is nothing
 * to operate, and every list says so by being empty rather than by erroring.
 */
@Injectable()
export class OperationsService {
  constructor(
    @InjectRepository(GameAttemptComment)
    private readonly commentRepo: Repository<GameAttemptComment>,
    private readonly seasons: SeasonsService,
  ) {}

  /**
   * Every clan in the season, both seats, and whether it is at war.
   *
   * Two queries rather than one: folding the war history into the member
   * aggregate would multiply every member row by every war.
   */
  async clans(): Promise<ClanRow[]> {
    const season = await this.seasons.current();
    if (!season) return [];

    const clans = returnedRows(
      await this.commentRepo.query(
        `SELECT c."id", c."name", c."status", c."inviteCode", c."createdAt",
                COALESCE(
                  json_agg(
                    json_build_object(
                      'enrolmentId', e."id", 'handle', e."handle", 'role', m."role",
                      'status', e."status", 'nerve', e."nerve", 'coins', e."coins",
                      'heartsRemaining', e."heartsRemaining", 'heartsTotal', e."heartsTotal"
                    ) ORDER BY m."role"
                  ) FILTER (WHERE m."id" IS NOT NULL),
                  '[]'
                ) AS "members"
           FROM "game_clans" c
           LEFT JOIN "game_clan_members" m ON m."clanId" = c."id"
           LEFT JOIN "game_enrolments" e ON e."id" = m."enrolmentId"
          WHERE c."seasonId" = $1
          GROUP BY c."id"
          ORDER BY c."createdAt" DESC`,
        [season.id],
      ),
    ) as {
      id: string;
      name: string;
      status: string;
      inviteCode: string;
      createdAt: Date;
      members: ClanMemberRow[];
    }[];
    if (clans.length === 0) return [];

    const wars = returnedRows(
      await this.commentRepo.query(
        `SELECT w."id", w."status", w."startsAt", w."winnerClanId",
                w."challengerClanId", w."opponentClanId",
                ch."name" AS "challengerName", op."name" AS "opponentName"
           FROM "game_clan_wars" w
           JOIN "game_clans" ch ON ch."id" = w."challengerClanId"
           JOIN "game_clans" op ON op."id" = w."opponentClanId"
          WHERE w."seasonId" = $1`,
        [season.id],
      ),
    ) as {
      id: string;
      status: string;
      startsAt: Date;
      winnerClanId: string | null;
      challengerClanId: string;
      opponentClanId: string;
      challengerName: string;
      opponentName: string;
    }[];

    return clans.map((clan) => {
      const mine = wars.filter(
        (w) => w.challengerClanId === clan.id || w.opponentClanId === clan.id,
      );
      const current = mine.find((w) =>
        ['proposed', 'accepted', 'live', 'judging'].includes(w.status),
      );
      return {
        id: clan.id,
        name: clan.name,
        status: clan.status,
        inviteCode: clan.inviteCode,
        createdAt: new Date(clan.createdAt).toISOString(),
        members: clan.members,
        nerve: clan.members.reduce((sum, m) => sum + (m.nerve ?? 0), 0),
        war: current
          ? {
              id: current.id,
              status: current.status,
              opponent:
                current.challengerClanId === clan.id
                  ? current.opponentName
                  : current.challengerName,
              startsAt: new Date(current.startsAt).toISOString(),
            }
          : null,
        warsFought: mine.filter((w) => w.status === 'settled').length,
        warsWon: mine.filter((w) => w.winnerClanId === clan.id).length,
      };
    });
  }

  /**
   * Every hand-in, not only the ones waiting on a verdict.
   *
   * The review queue shows `submitted`; this is where an operator finds a
   * published clip to take down, a rejection to explain, or everything one
   * player has done — without pasting an id from somewhere else.
   */
  async attempts(
    filter: {
      status?: AttemptStatus;
      day?: number;
      enrolmentId?: string;
      hidden?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ items: AttemptRow[]; total: number }> {
    const season = await this.seasons.current();
    if (!season) return { items: [], total: 0 };

    const where = ['a."seasonId" = $1'];
    const params: unknown[] = [season.id];
    const add = (clause: string, value: unknown) => {
      params.push(value);
      where.push(clause.replace('?', `$${params.length}`));
    };
    if (filter.status) add('a."status" = ?', filter.status);
    if (filter.day) add('a."day" = ?', filter.day);
    if (filter.enrolmentId) add('a."enrolmentId" = ?', filter.enrolmentId);
    if (filter.hidden === true) where.push('a."hiddenAt" IS NOT NULL');
    if (filter.hidden === false) where.push('a."hiddenAt" IS NULL');

    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);

    const [{ total }] = returnedRows(
      await this.commentRepo.query(
        `SELECT count(*)::int AS "total" FROM "game_attempts" a WHERE ${where.join(' AND ')}`,
        params,
      ),
    ) as { total: number }[];

    const rows = returnedRows(
      await this.commentRepo.query(
        `SELECT a."id", a."enrolmentId", e."handle", e."status" AS "playerStatus",
                t."title" AS "task", a."day", a."kind", a."status", a."mediaUrl",
                a."caption", a."submittedAt", a."publishedAt", a."hiddenAt",
                a."rejectionReason", a."aiVerdict"->>'verdict' AS "verdict",
                (a."aiVerdict"->>'confidence')::float AS "confidence",
                a."votingStatus", a."likeCount", a."commentCount", a."createdAt"
           FROM "game_attempts" a
           JOIN "game_enrolments" e ON e."id" = a."enrolmentId"
           LEFT JOIN "game_task_templates" t ON t."id" = a."taskTemplateId"
          WHERE ${where.join(' AND ')}
          ORDER BY COALESCE(a."submittedAt", a."createdAt") DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
    ) as AttemptRow[];

    return { items: rows.map(isoRow), total };
  }

  /**
   * Votes still open, and votes the resolver could not decide.
   *
   * `deferred` is the one that needs a person: the watchers split, or the
   * model was not sure, and the attempt is waiting in the review queue with
   * a vote attached. Seeing the tally is what makes that verdict easy.
   */
  async votes(
    status: 'open' | 'deferred' | 'resolving' | 'all' = 'all',
  ): Promise<VoteRow[]> {
    const season = await this.seasons.current();
    if (!season) return [];
    const statuses =
      status === 'all' ? ['open', 'deferred', 'resolving'] : [status];

    const rows = returnedRows(
      await this.commentRepo.query(
        `SELECT a."id" AS "attemptId", e."handle", t."title" AS "task", a."day",
                a."kind", a."mediaUrl", a."votingStatus", a."votingEndsAt",
                a."aiVerdict"->>'verdict' AS "verdict",
                count(*) FILTER (WHERE v."vote" = 'yes')::int AS "yes",
                count(*) FILTER (WHERE v."vote" = 'no')::int AS "no"
           FROM "game_attempts" a
           JOIN "game_enrolments" e ON e."id" = a."enrolmentId"
           LEFT JOIN "game_task_templates" t ON t."id" = a."taskTemplateId"
           LEFT JOIN "game_attempt_votes" v ON v."attemptId" = a."id"
          WHERE a."seasonId" = $1 AND a."votingStatus" = ANY($2::text[])
          GROUP BY a."id", e."handle", t."title"
          ORDER BY a."votingEndsAt" ASC NULLS LAST
          LIMIT 200`,
        [season.id, statuses],
      ),
    ) as VoteRow[];
    return rows.map(isoRow);
  }

  /**
   * Tasks people are holding, and the clocks running on them.
   *
   * The first place to look when a player says their clock ran out unfairly:
   * when they accepted, when it was due, and whether a heart went.
   */
  async clocks(
    status: AssignmentStatus | 'running' | 'all' = 'running',
  ): Promise<ClockRow[]> {
    const season = await this.seasons.current();
    if (!season) return [];
    const statuses =
      status === 'running'
        ? ['offered', 'accepted']
        : status === 'all'
          ? ['offered', 'accepted', 'declined', 'submitted', 'expired']
          : [status];

    const rows = returnedRows(
      await this.commentRepo.query(
        `SELECT s."id", s."enrolmentId", e."handle", c."name" AS "clan",
                t."title" AS "task", s."day", s."status", s."clockMinutes",
                s."acceptedAt", s."expiresAt", s."heartBurned", s."createdAt",
                CASE WHEN s."expiresAt" IS NULL THEN NULL
                     ELSE EXTRACT(EPOCH FROM (s."expiresAt" - now()))::int END AS "secondsLeft"
           FROM "game_task_assignments" s
           JOIN "game_enrolments" e ON e."id" = s."enrolmentId"
           JOIN "game_task_templates" t ON t."id" = s."taskTemplateId"
           LEFT JOIN "game_clans" c ON c."id" = s."clanId"
          WHERE s."seasonId" = $1 AND s."status" = ANY($2::text[])
          ORDER BY s."expiresAt" ASC NULLS LAST, s."createdAt" DESC
          LIMIT 300`,
        [season.id, statuses],
      ),
    ) as ClockRow[];
    return rows.map(isoRow);
  }

  /** Every comment on a hand-in, hidden ones included. */
  async comments(attemptId: string): Promise<CommentRow[]> {
    const rows = await this.commentRepo.find({
      where: { attemptId },
      order: { createdAt: 'ASC' },
    });
    return rows.map((c) => ({
      id: c.id,
      authorHandle: c.authorHandle,
      userId: c.userId,
      body: c.body,
      hiddenAt: c.hiddenAt ? new Date(c.hiddenAt).toISOString() : null,
      createdAt: new Date(c.createdAt).toISOString(),
    }));
  }

  /**
   * Hides or restores a comment.
   *
   * Hiding, not deleting: the reports system hides comments the same way,
   * and a hidden comment can be put back when the call was wrong. A deleted
   * one cannot, and neither can the report that pointed at it.
   */
  async setCommentHidden(
    commentId: string,
    hidden: boolean,
  ): Promise<CommentRow> {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    await this.commentRepo.query(
      `UPDATE "game_attempt_comments"
          SET "hiddenAt" = ${hidden ? 'COALESCE("hiddenAt", now())' : 'NULL'},
              "updatedAt" = now()
        WHERE "id" = $1`,
      [commentId],
    );
    const fresh = await this.commentRepo.findOne({ where: { id: commentId } });
    const row = fresh ?? comment;
    return {
      id: row.id,
      authorHandle: row.authorHandle,
      userId: row.userId,
      body: row.body,
      hiddenAt: row.hiddenAt ? new Date(row.hiddenAt).toISOString() : null,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }
}

/** Raw rows come back with `Date` objects; the API speaks ISO strings. */
function isoRow<T extends object>(row: T): T {
  const out = { ...row } as Record<string, unknown>;
  for (const [key, value] of Object.entries(out)) {
    if (value instanceof Date) out[key] = value.toISOString();
  }
  return out as T;
}
