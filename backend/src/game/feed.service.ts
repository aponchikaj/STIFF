import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { rowsAffected } from '../common/utils/returned-rows';
import { User } from '../users/user.entity';
import { GameAttemptComment } from './entities/game-attempt-comment.entity';
import { GameAttemptReaction } from './entities/game-attempt-reaction.entity';
import { GameAttempt } from './entities/game-attempt.entity';
import { GameEnrolment } from './entities/game-enrolment.entity';
import type { AttemptKind, SeasonDay } from './media-rules';
import { SeasonsService } from './seasons.service';

/** A reel is scrolled, not paged — a cursor, so new items cannot shift a page. */
export const FEED_PAGE_SIZE = 12;
export const MAX_FEED_PAGE_SIZE = 40;

export interface FeedItem {
  id: string;
  day: SeasonDay;
  kind: AttemptKind;
  mediaUrl: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  player: { handle: string; nerve: number };
  likeCount: number;
  commentCount: number;
  shareCount: number;
  /** Null for anonymous readers — the feed is readable without an account. */
  likedByMe: boolean | null;
  publishedAt: string;
  /** What the share sheet turns into a story card. */
  shareUrl: string;
}

export interface FeedPage {
  items: FeedItem[];
  /** Opaque. Pass back as `cursor` for the next screenful; null at the end. */
  nextCursor: string | null;
}

export interface CommentView {
  id: string;
  body: string;
  authorHandle: string;
  isMine: boolean;
  createdAt: string;
}

@Injectable()
export class FeedService {
  constructor(
    @InjectRepository(GameAttempt)
    private readonly attemptRepo: Repository<GameAttempt>,
    @InjectRepository(GameAttemptReaction)
    private readonly reactionRepo: Repository<GameAttemptReaction>,
    @InjectRepository(GameAttemptComment)
    private readonly commentRepo: Repository<GameAttemptComment>,
    @InjectRepository(GameEnrolment)
    private readonly enrolmentRepo: Repository<GameEnrolment>,
    private readonly seasonsService: SeasonsService,
  ) {}

  /**
   * The scrollable feed of published attempts, newest first.
   *
   * Cursor-based rather than offset: a reel is scrolled while people are still
   * publishing, and an offset page would show the same clip twice or skip one
   * every time something new arrived above it.
   */
  async list(
    user: User | null,
    options: { cursor?: string; limit?: number; day?: number } = {},
  ): Promise<FeedPage> {
    const season = await this.seasonsService.current();
    if (!season) return { items: [], nextCursor: null };

    const limit = Math.min(
      Math.max(options.limit ?? FEED_PAGE_SIZE, 1),
      MAX_FEED_PAGE_SIZE,
    );

    const qb = this.attemptRepo
      .createQueryBuilder('attempt')
      .innerJoin('attempt.enrolment', 'enrolment')
      .addSelect(['enrolment.handle', 'enrolment.nerve'])
      .where('attempt.seasonId = :seasonId', { seasonId: season.id })
      .andWhere('attempt.status = :status', { status: 'published' })
      .andWhere('attempt.publishedAt IS NOT NULL');

    if (options.day !== undefined) {
      qb.andWhere('attempt.day = :day', { day: options.day });
    }

    const cursor = decodeCursor(options.cursor);
    if (cursor) {
      // Ordered by (publishedAt, id) so two clips published in the same
      // millisecond still have one stable order and neither is skipped.
      qb.andWhere(
        '(attempt.publishedAt, attempt.id) < (:cursorAt, :cursorId)',
        { cursorAt: cursor.publishedAt, cursorId: cursor.id },
      );
    }

    const rows = await qb
      .orderBy('attempt.publishedAt', 'DESC')
      .addOrderBy('attempt.id', 'DESC')
      .take(limit + 1)
      .getMany();

    const page = rows.slice(0, limit);
    const liked = await this.likedAmong(user, page);

    return {
      items: page.map((attempt) => this.toFeedItem(attempt, user, liked)),
      nextCursor:
        rows.length > limit && page.length > 0
          ? encodeCursor(page[page.length - 1])
          : null,
    };
  }

  async getOne(user: User | null, id: string): Promise<FeedItem> {
    const attempt = await this.attemptRepo.findOne({
      where: { id, status: 'published' },
      relations: { enrolment: true },
    });
    if (!attempt) throw new NotFoundException('Not found');
    const liked = await this.likedAmong(user, [attempt]);
    return this.toFeedItem(attempt, user, liked);
  }

  /**
   * Toggle a like.
   *
   * The insert is conditional rather than read-then-write: two taps arriving
   * together would both see "not liked" and the second would hit the unique
   * index as a 500. `ON CONFLICT DO NOTHING` makes the database decide, and
   * `rowsAffected` reads whether this call was the one that added it.
   */
  async toggleLike(
    user: User,
    attemptId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const attempt = await this.requirePublished(attemptId);

    const inserted = rowsAffected(
      await this.reactionRepo.query(
        `INSERT INTO "game_attempt_reactions" ("attemptId", "userId")
         VALUES ($1, $2)
         ON CONFLICT ("attemptId", "userId") DO NOTHING
         RETURNING "id"`,
        [attempt.id, user.id],
      ),
    );
    if (inserted === 0) {
      await this.reactionRepo.delete({
        attemptId: attempt.id,
        userId: user.id,
      });
    }

    const likeCount = await this.recount(attempt.id);
    return { liked: inserted > 0, likeCount };
  }

  /**
   * Records that someone tapped share.
   *
   * Instagram has no web API for posting to Stories, so the browser composes a
   * card and hands it to the OS share sheet — nothing ever tells us whether it
   * was actually posted. This counts taps and says so; treating it as reach
   * would be inventing a number.
   */
  async recordShare(attemptId: string): Promise<{ shareCount: number }> {
    const attempt = await this.requirePublished(attemptId);
    await this.attemptRepo.increment({ id: attempt.id }, 'shareCount', 1);
    const fresh = await this.attemptRepo.findOne({
      where: { id: attempt.id },
      select: { shareCount: true },
    });
    return { shareCount: fresh?.shareCount ?? attempt.shareCount + 1 };
  }

  async listComments(
    user: User | null,
    attemptId: string,
  ): Promise<CommentView[]> {
    await this.requirePublished(attemptId);
    const comments = await this.commentRepo.find({
      where: { attemptId },
      order: { createdAt: 'ASC' },
      take: 200,
    });
    return comments.map((c) => ({
      id: c.id,
      body: c.body,
      authorHandle: c.authorHandle,
      isMine: user ? c.userId === user.id : false,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async addComment(
    user: User,
    attemptId: string,
    body: string,
  ): Promise<CommentView> {
    const attempt = await this.requirePublished(attemptId);

    const trimmed = body.trim();
    if (!trimmed) throw new BadRequestException('Say something.');

    // The handle is snapshotted the way the enrolment's is, so a thread still
    // reads correctly after someone renames their account. Watchers who never
    // enrolled fall back to their shop username.
    const enrolment = await this.enrolmentRepo.findOne({
      where: { seasonId: attempt.seasonId, userId: user.id },
    });

    const comment = await this.commentRepo.save(
      this.commentRepo.create({
        attemptId: attempt.id,
        userId: user.id,
        authorHandle: enrolment?.handle ?? user.username,
        body: trimmed,
      }),
    );

    await this.recountComments(attempt.id);
    return {
      id: comment.id,
      body: comment.body,
      authorHandle: comment.authorHandle,
      isMine: true,
      createdAt: comment.createdAt.toISOString(),
    };
  }

  /** Own comment, or an admin moderating. */
  async removeComment(user: User, commentId: string): Promise<void> {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('You can only delete your own comments');
    }
    await this.commentRepo.delete({ id: comment.id });
    await this.recountComments(comment.attemptId);
  }

  // ---------------------------------------------------------------- helpers

  private async requirePublished(id: string): Promise<GameAttempt> {
    const attempt = await this.attemptRepo.findOne({
      where: { id, status: 'published' },
    });
    if (!attempt) throw new NotFoundException('Not found');
    return attempt;
  }

  /** One query for the whole screenful rather than one per item. */
  private async likedAmong(
    user: User | null,
    attempts: GameAttempt[],
  ): Promise<Set<string>> {
    if (!user || attempts.length === 0) return new Set();
    const rows = await this.reactionRepo
      .createQueryBuilder('reaction')
      .select('reaction.attemptId', 'attemptId')
      .where('reaction.userId = :userId', { userId: user.id })
      .andWhere('reaction.attemptId IN (:...ids)', {
        ids: attempts.map((a) => a.id),
      })
      .getRawMany<{ attemptId: string }>();
    return new Set(rows.map((r) => r.attemptId));
  }

  private async recount(attemptId: string): Promise<number> {
    const likeCount = await this.reactionRepo.count({ where: { attemptId } });
    await this.attemptRepo.update({ id: attemptId }, { likeCount });
    return likeCount;
  }

  private async recountComments(attemptId: string): Promise<number> {
    const commentCount = await this.commentRepo.count({ where: { attemptId } });
    await this.attemptRepo.update({ id: attemptId }, { commentCount });
    return commentCount;
  }

  private toFeedItem(
    attempt: GameAttempt,
    user: User | null,
    liked: Set<string>,
  ): FeedItem {
    return {
      id: attempt.id,
      day: attempt.day,
      kind: attempt.kind,
      mediaUrl: attempt.mediaUrl,
      durationSeconds: attempt.durationSeconds,
      width: attempt.width,
      height: attempt.height,
      caption: attempt.caption,
      player: {
        handle: attempt.enrolment?.handle ?? 'unknown',
        nerve: attempt.enrolment?.nerve ?? 0,
      },
      likeCount: attempt.likeCount,
      commentCount: attempt.commentCount,
      shareCount: attempt.shareCount,
      likedByMe: user ? liked.has(attempt.id) : null,
      publishedAt: (attempt.publishedAt ?? attempt.createdAt).toISOString(),
      shareUrl: shareUrlFor(attempt.id),
    };
  }
}

/** Where the share card points. The game origin, never the shop's. */
export function shareUrlFor(attemptId: string): string {
  const base = (
    process.env.GAME_FRONTEND_URL ?? 'https://game.stiff.ge'
  ).replace(/\/+$/, '');
  return `${base}/r/${attemptId}`;
}

interface FeedCursor {
  publishedAt: string;
  id: string;
}

export function encodeCursor(attempt: GameAttempt): string {
  const at = (attempt.publishedAt ?? attempt.createdAt).toISOString();
  return Buffer.from(`${at}|${attempt.id}`, 'utf8').toString('base64url');
}

/** Anything unreadable is treated as "start from the top", never as an error. */
export function decodeCursor(raw: string | undefined): FeedCursor | null {
  if (!raw) return null;
  try {
    const [publishedAt, id] = Buffer.from(raw, 'base64url')
      .toString('utf8')
      .split('|');
    if (!publishedAt || !id) return null;
    if (Number.isNaN(Date.parse(publishedAt))) return null;
    return { publishedAt, id };
  } catch {
    return null;
  }
}
