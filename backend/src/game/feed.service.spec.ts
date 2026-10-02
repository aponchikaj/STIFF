import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../users/user.entity';
import { GameAttemptComment } from './entities/game-attempt-comment.entity';
import { GameAttemptReaction } from './entities/game-attempt-reaction.entity';
import { GameAttempt } from './entities/game-attempt.entity';
import { GameEnrolment } from './entities/game-enrolment.entity';
import {
  FeedService,
  MAX_FEED_PAGE_SIZE,
  decodeCursor,
  encodeCursor,
} from './feed.service';
import { CHEATER_NOTICE } from './rules';
import { SeasonsService } from './seasons.service';

/**
 * The reel a watcher scrolls, and what they can do to an item in it.
 *
 * The feed reads without an account on purpose — it is the thing that makes
 * someone want one — so the interesting cases are the ones where "no user"
 * has to mean something other than "user who has not liked this".
 */

const WATCHER = { id: 'u1', username: 'kate', role: 'user' } as User;
const ADMIN = { id: 'u9', username: 'boss', role: 'admin' } as User;

function attempt(overrides: Partial<GameAttempt> = {}): GameAttempt {
  return {
    id: 'a1',
    seasonId: 's1',
    day: 1,
    kind: 'video',
    status: 'published',
    mediaUrl: 'https://media.stiff.ge/a.mp4',
    durationSeconds: 42,
    width: 720,
    height: 1280,
    caption: 'every black thing I own',
    likeCount: 3,
    commentCount: 1,
    shareCount: 0,
    publishedAt: new Date('2026-09-06T10:00:00.000Z'),
    createdAt: new Date('2026-09-06T09:00:00.000Z'),
    enrolment: {
      handle: 'asterisk',
      nerve: 140,
      status: 'active',
    } as GameEnrolment,
    ...overrides,
  } as GameAttempt;
}

function queryBuilder() {
  const qb: Record<string, jest.Mock> = {};
  for (const m of [
    'innerJoin',
    'addSelect',
    'select',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'take',
  ]) {
    qb[m] = jest.fn(() => qb);
  }
  qb.getMany = jest.fn().mockResolvedValue([]);
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  return qb;
}

describe('FeedService', () => {
  let service: FeedService;
  let attemptQb: Record<string, jest.Mock>;
  let reactionQb: Record<string, jest.Mock>;
  let attemptRepo: Record<string, jest.Mock>;
  let reactionRepo: Record<string, jest.Mock>;
  let commentRepo: Record<string, jest.Mock>;
  let enrolmentRepo: Record<string, jest.Mock>;
  let seasons: { current: jest.Mock };

  beforeEach(async () => {
    attemptQb = queryBuilder();
    reactionQb = queryBuilder();

    attemptRepo = {
      createQueryBuilder: jest.fn(() => attemptQb),
      findOne: jest.fn().mockResolvedValue(attempt()),
      update: jest.fn().mockResolvedValue(undefined),
      increment: jest.fn().mockResolvedValue(undefined),
    };
    reactionRepo = {
      createQueryBuilder: jest.fn(() => reactionQb),
      query: jest.fn().mockResolvedValue([[{ id: 'r1' }], 1]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      count: jest.fn().mockResolvedValue(4),
    };
    commentRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((c: unknown) =>
        Promise.resolve({ id: 'c1', createdAt: new Date(), ...(c as object) }),
      ),
      create: jest.fn((c: unknown) => c),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      count: jest.fn().mockResolvedValue(2),
    };
    enrolmentRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
    };
    seasons = { current: jest.fn().mockResolvedValue({ id: 's1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedService,
        { provide: getRepositoryToken(GameAttempt), useValue: attemptRepo },
        {
          provide: getRepositoryToken(GameAttemptReaction),
          useValue: reactionRepo,
        },
        {
          provide: getRepositoryToken(GameAttemptComment),
          useValue: commentRepo,
        },
        { provide: getRepositoryToken(GameEnrolment), useValue: enrolmentRepo },
        { provide: SeasonsService, useValue: seasons },
      ],
    }).compile();

    service = module.get(FeedService);
  });

  describe('list', () => {
    it('is empty between seasons rather than an error', async () => {
      seasons.current.mockResolvedValue(null);
      await expect(service.list(null)).resolves.toEqual({
        items: [],
        nextCursor: null,
      });
    });

    it('only ever shows published attempts', async () => {
      await service.list(null);
      expect(attemptQb.andWhere).toHaveBeenCalledWith(
        'attempt.status = :status',
        { status: 'published' },
      );
    });

    it('carries the player and the media through', async () => {
      attemptQb.getMany.mockResolvedValue([attempt()]);
      const { items } = await service.list(null);
      expect(items[0]).toMatchObject({
        kind: 'video',
        durationSeconds: 42,
        mediaUrl: 'https://media.stiff.ge/a.mp4',
        player: { handle: 'asterisk', nerve: 140, status: 'active' },
      });
    });

    /**
     * `false` would be a claim about someone who does not exist. Null says
     * "nobody is signed in", which is what the button needs to know.
     */
    it('reports likedByMe as null for a signed-out reader', async () => {
      attemptQb.getMany.mockResolvedValue([attempt()]);
      const { items } = await service.list(null);
      expect(items[0].likedByMe).toBeNull();
    });

    it('reports likedByMe for a signed-in reader', async () => {
      attemptQb.getMany.mockResolvedValue([attempt()]);
      reactionQb.getRawMany.mockResolvedValue([{ attemptId: 'a1' }]);
      const { items } = await service.list(WATCHER);
      expect(items[0].likedByMe).toBe(true);
    });

    it('reports false when a signed-in reader has not liked it', async () => {
      attemptQb.getMany.mockResolvedValue([attempt()]);
      reactionQb.getRawMany.mockResolvedValue([]);
      const { items } = await service.list(WATCHER);
      expect(items[0].likedByMe).toBe(false);
    });

    /** One query for the screenful, not one per item. */
    it('does not ask about likes at all when signed out', async () => {
      attemptQb.getMany.mockResolvedValue([attempt()]);
      await service.list(null);
      expect(reactionRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('gives every item a share URL on the game origin', async () => {
      attemptQb.getMany.mockResolvedValue([attempt()]);
      const { items } = await service.list(null);
      expect(items[0].shareUrl).toMatch(/\/r\/a1$/);
      expect(items[0].shareUrl).not.toContain('//stiff.ge');
    });

    /**
     * A reel is scrolled while people are still publishing. An offset page
     * would repeat or skip an item every time something new arrived above it.
     */
    it('pages on a cursor, and stops at the end', async () => {
      attemptQb.getMany.mockResolvedValue([attempt({ id: 'a1' })]);
      const page = await service.list(null, { limit: 5 });
      expect(page.nextCursor).toBeNull();
    });

    it('hands back a cursor when there is more', async () => {
      // One more than asked for is how "there is another page" is detected.
      attemptQb.getMany.mockResolvedValue([
        attempt({ id: 'a1' }),
        attempt({ id: 'a2' }),
      ]);
      const page = await service.list(null, { limit: 1 });
      expect(page.items).toHaveLength(1);
      expect(page.nextCursor).not.toBeNull();
    });

    it('clamps a limit nobody should be asking for', async () => {
      await service.list(null, { limit: 9999 });
      expect(attemptQb.take).toHaveBeenCalledWith(MAX_FEED_PAGE_SIZE + 1);
    });

    it('can be narrowed to one day', async () => {
      await service.list(null, { day: 2 });
      expect(attemptQb.andWhere).toHaveBeenCalledWith('attempt.day = :day', {
        day: 2,
      });
    });
  });

  describe('toggleLike', () => {
    it('adds a like when there was none', async () => {
      reactionRepo.query.mockResolvedValue([[{ id: 'r1' }], 1]);
      const result = await service.toggleLike(WATCHER, 'a1');
      expect(result.liked).toBe(true);
      expect(reactionRepo.delete).not.toHaveBeenCalled();
    });

    /**
     * The insert is conditional rather than read-then-write: two taps arriving
     * together would both read "not liked" and the second would hit the unique
     * index as a 500. The database decides, and the row count says which tap
     * this was.
     */
    it('takes it away when the row was already there', async () => {
      reactionRepo.query.mockResolvedValue([[], 0]);
      const result = await service.toggleLike(WATCHER, 'a1');
      expect(result.liked).toBe(false);
      expect(reactionRepo.delete).toHaveBeenCalledWith({
        attemptId: 'a1',
        userId: 'u1',
      });
    });

    it('recounts from the reactions rather than incrementing', async () => {
      reactionRepo.count.mockResolvedValue(7);
      const result = await service.toggleLike(WATCHER, 'a1');
      expect(result.likeCount).toBe(7);
      expect(attemptRepo.update).toHaveBeenCalledWith(
        { id: 'a1' },
        { likeCount: 7 },
      );
    });

    it('refuses an item that is not published', async () => {
      attemptRepo.findOne.mockResolvedValue(null);
      await expect(service.toggleLike(WATCHER, 'a1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('recordShare', () => {
    it('counts the tap', async () => {
      attemptRepo.findOne
        .mockResolvedValueOnce(attempt())
        .mockResolvedValueOnce({ shareCount: 9 });
      const result = await service.recordShare('a1');
      expect(attemptRepo.increment).toHaveBeenCalledWith(
        { id: 'a1' },
        'shareCount',
        1,
      );
      expect(result.shareCount).toBe(9);
    });

    it('refuses an unpublished item', async () => {
      attemptRepo.findOne.mockResolvedValue(null);
      await expect(service.recordShare('a1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('comments', () => {
    it('refuses an empty comment', async () => {
      await expect(service.addComment(WATCHER, 'a1', '   ')).rejects.toThrow(
        /Say something/,
      );
    });

    it('trims what it stores', async () => {
      const result = await service.addComment(WATCHER, 'a1', '  nice  ');
      expect(result.body).toBe('nice');
    });

    /** So a thread still reads correctly after someone renames themselves. */
    it('snapshots the enrolment handle when there is one', async () => {
      enrolmentRepo.findOne.mockResolvedValue({ handle: 'in-season-name' });
      const result = await service.addComment(WATCHER, 'a1', 'nice');
      expect(result.authorHandle).toBe('in-season-name');
    });

    it('falls back to the shop username for someone who never enrolled', async () => {
      enrolmentRepo.findOne.mockResolvedValue(null);
      const result = await service.addComment(WATCHER, 'a1', 'nice');
      expect(result.authorHandle).toBe('kate');
    });

    it('keeps the denormalised count in step', async () => {
      commentRepo.count.mockResolvedValue(5);
      await service.addComment(WATCHER, 'a1', 'nice');
      expect(attemptRepo.update).toHaveBeenCalledWith(
        { id: 'a1' },
        { commentCount: 5 },
      );
    });

    it('marks a reader’s own comments', async () => {
      commentRepo.find.mockResolvedValue([
        {
          id: 'c1',
          body: 'mine',
          authorHandle: 'kate',
          userId: 'u1',
          createdAt: new Date(),
        },
        {
          id: 'c2',
          body: 'theirs',
          authorHandle: 'sam',
          userId: 'u2',
          createdAt: new Date(),
        },
      ]);
      const comments = await service.listComments(WATCHER, 'a1');
      expect(comments.map((c) => c.isMine)).toEqual([true, false]);
    });

    /**
     * The label is not stored on the comment. It is the author's standing
     * this season at the moment of reading, so a flag applied today reaches
     * every comment they ever wrote.
     */
    it('says so on every comment a cheater wrote', async () => {
      commentRepo.find.mockResolvedValue([
        {
          id: 'c1',
          body: 'lol fake',
          authorHandle: 'sam',
          userId: 'u2',
          createdAt: new Date(),
        },
        {
          id: 'c2',
          body: 'nice',
          authorHandle: 'kate',
          userId: 'u1',
          createdAt: new Date(),
        },
      ]);
      enrolmentRepo.find.mockResolvedValue([
        { userId: 'u2', status: 'cheater' },
        { userId: 'u1', status: 'active' },
      ]);

      const comments = await service.listComments(WATCHER, 'a1');

      expect(comments[0]).toMatchObject({
        authorStatus: 'cheater',
        notice: CHEATER_NOTICE,
      });
      expect(comments[0].notice).toBe('CHEATER WROTE A COMMENT');
      expect(comments[1]).toMatchObject({
        authorStatus: 'active',
        notice: null,
      });
      // One query for the thread, scoped to this season's enrolments.
      expect(enrolmentRepo.find).toHaveBeenCalledTimes(1);
      const [query] = enrolmentRepo.find.mock.calls[0] as [
        { where: { seasonId: string } },
      ];
      expect(query.where.seasonId).toBe('s1');
    });

    it('has no standing for an author who never enrolled', async () => {
      commentRepo.find.mockResolvedValue([
        {
          id: 'c1',
          body: 'hi',
          authorHandle: 'guest',
          userId: 'u3',
          createdAt: new Date(),
        },
      ]);
      const comments = await service.listComments(null, 'a1');
      expect(comments[0]).toMatchObject({ authorStatus: null, notice: null });
    });

    it('does not query standings for an empty thread', async () => {
      await service.listComments(null, 'a1');
      expect(enrolmentRepo.find).not.toHaveBeenCalled();
    });

    it('labels a cheater’s new comment as it is written', async () => {
      enrolmentRepo.findOne.mockResolvedValue({
        handle: 'sam',
        status: 'cheater',
      });
      const result = await service.addComment(WATCHER, 'a1', 'was real!!');
      expect(result.notice).toBe(CHEATER_NOTICE);
      expect(result.authorStatus).toBe('cheater');
      // The comment itself is still stored — a cheater may speak, labelled.
      expect(commentRepo.save).toHaveBeenCalled();
    });

    it('labels nothing on an honest comment', async () => {
      enrolmentRepo.findOne.mockResolvedValue({
        handle: 'kate',
        status: 'active',
      });
      const result = await service.addComment(WATCHER, 'a1', 'nice');
      expect(result.notice).toBeNull();
      expect(result.authorStatus).toBe('active');
    });

    it('marks nothing as mine for a signed-out reader', async () => {
      commentRepo.find.mockResolvedValue([
        {
          id: 'c1',
          body: 'x',
          authorHandle: 'k',
          userId: 'u1',
          createdAt: new Date(),
        },
      ]);
      const comments = await service.listComments(null, 'a1');
      expect(comments[0].isMine).toBe(false);
    });

    it('lets an author delete their own', async () => {
      commentRepo.findOne.mockResolvedValue({
        id: 'c1',
        userId: 'u1',
        attemptId: 'a1',
      });
      await service.removeComment(WATCHER, 'c1');
      expect(commentRepo.delete).toHaveBeenCalledWith({ id: 'c1' });
    });

    it('lets an admin moderate anyone', async () => {
      commentRepo.findOne.mockResolvedValue({
        id: 'c1',
        userId: 'someone-else',
        attemptId: 'a1',
      });
      await service.removeComment(ADMIN, 'c1');
      expect(commentRepo.delete).toHaveBeenCalledWith({ id: 'c1' });
    });

    it("refuses to let a watcher delete someone else's", async () => {
      commentRepo.findOne.mockResolvedValue({
        id: 'c1',
        userId: 'someone-else',
        attemptId: 'a1',
      });
      await expect(service.removeComment(WATCHER, 'c1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(commentRepo.delete).not.toHaveBeenCalled();
    });
  });
});

describe('feed cursors', () => {
  /**
   * A real uuid rather than the fixture's `'a1'`, because the id half of a
   * cursor is compared against a uuid column — a short fake round-trips fine
   * in JavaScript and is exactly what let an invalid id reach Postgres.
   */
  it('round-trips', () => {
    const id = '3f1a5c8e-9b2d-4e7a-8c1f-2d4b6a8e0c31';
    const decoded = decodeCursor(encodeCursor(attempt({ id })));
    expect(decoded).toEqual({
      publishedAt: '2026-09-06T10:00:00.000Z',
      id,
    });
  });

  /** A bad cursor means "start from the top", never a 500. */
  it('treats anything unreadable as no cursor at all', () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor('not-base64-!!')).toBeNull();
    expect(
      decodeCursor(Buffer.from('nopipe').toString('base64url')),
    ).toBeNull();
    expect(
      decodeCursor(Buffer.from('not-a-date|a1').toString('base64url')),
    ).toBeNull();
  });

  /**
   * The half of "unreadable" that a well-formed date hides.
   *
   * `attempt.id` is a uuid column, so the id half of the cursor is compared
   * against one. Postgres does not shrug at `'not-a-uuid'` — it raises
   * `invalid input syntax for type uuid`, which surfaces as a 500 on a route
   * anyone can call without an account. Checking the date and not the id
   * makes the guard look complete while leaving the reachable half open.
   */
  it('rejects a cursor whose id is not a uuid', () => {
    const crafted = (id: string) =>
      Buffer.from(`2026-09-06T10:00:00.000Z|${id}`).toString('base64url');

    expect(decodeCursor(crafted('not-a-uuid'))).toBeNull();
    expect(decodeCursor(crafted("' OR 1=1--"))).toBeNull();
    expect(decodeCursor(crafted('a1'))).toBeNull();
    // Right shape, wrong characters — 'g' is not a hex digit.
    expect(
      decodeCursor(crafted('gggggggg-gggg-4ggg-8ggg-gggggggggggg')),
    ).toBeNull();
  });

  it('accepts a cursor carrying a real uuid', () => {
    const id = '3f1a5c8e-9b2d-4e7a-8c1f-2d4b6a8e0c31';
    expect(
      decodeCursor(
        Buffer.from(`2026-09-06T10:00:00.000Z|${id}`).toString('base64url'),
      ),
    ).toEqual({ publishedAt: '2026-09-06T10:00:00.000Z', id });
  });
});
