import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { NotificationsService } from '../../notifications/notifications.service';
import { User } from '../../users/user.entity';
import { DisciplineService } from '../discipline.service';
import { GameAttemptComment } from '../entities/game-attempt-comment.entity';
import { GameAttempt } from '../entities/game-attempt.entity';
import { GameClan, GameClanMember } from '../entities/game-clan.entity';
import { GameEnrolment } from '../entities/game-enrolment.entity';
import { GameReport } from '../entities/game-report.entity';
import { GamePurchase, GameShopItem } from '../entities/game-shop.entity';
import { GameTaskTemplate } from '../entities/game-task-template.entity';
import { FeedService } from '../feed.service';
import { SeasonsService } from '../seasons.service';
import { ShopService } from '../shop.service';
import { TaskTemplatesService } from '../task-templates.service';
import { VerdictsService } from '../verdicts.service';
import { describe as describeTarget, ReportsService } from './reports.service';

/**
 * Filing and resolving, with every neighbour stood in for.
 *
 * What matters here is the gate, not the SQL: who may report what for
 * which reason, that the second tap and the twenty-first report are
 * refused, that enough different reporters hide a thing, and that closing
 * a report performs its action through the service that owns it — and
 * leaves the report open if that service refuses.
 */

const KATE = { id: 'u-kate', username: 'kate', role: 'user' } as User;
const OMAR = { id: 'u-omar', username: 'omar', role: 'user' } as User;
const ADMIN = { id: 'u-boss', username: 'boss', role: 'admin' } as User;

const SEASON = { id: 's1', title: 'One', status: 'running' };

function report(overrides: Partial<GameReport> = {}): GameReport {
  return {
    id: 'r1',
    seasonId: 's1',
    reporterId: KATE.id,
    reporterHandle: 'kate',
    targetType: 'comment',
    targetId: 'c1',
    targetUserId: OMAR.id,
    snapshot: { body: 'ugh', handle: 'omar', attemptId: 'a1' },
    reason: 'harassment',
    details: null,
    tags: [],
    context: null,
    priority: 2,
    status: 'open',
    assignedTo: null,
    action: null,
    note: null,
    reporterMessage: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date('2026-09-11T10:00:00Z'),
    updatedAt: new Date('2026-09-11T10:00:00Z'),
    ...overrides,
  } as GameReport;
}

function queryBuilder(results: {
  rawOne?: unknown;
  rawMany?: unknown[];
  manyAndCount?: [unknown[], number];
  affected?: number;
}) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of [
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'addGroupBy',
    'orderBy',
    'addOrderBy',
    'limit',
    'skip',
    'take',
    'update',
    'set',
  ]) {
    qb[m] = jest.fn(() => qb);
  }
  qb.getRawOne = jest.fn().mockResolvedValue(results.rawOne ?? { n: '0' });
  qb.getRawMany = jest.fn().mockResolvedValue(results.rawMany ?? []);
  qb.getManyAndCount = jest
    .fn()
    .mockResolvedValue(results.manyAndCount ?? [[], 0]);
  qb.execute = jest.fn().mockResolvedValue({ affected: results.affected ?? 0 });
  return qb;
}

function repo(extra: Record<string, unknown> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    save: jest.fn((row: unknown) => Promise.resolve(row)),
    create: jest.fn((row: unknown) => ({
      ...(row as object),
      id: 'new',
      createdAt: new Date('2026-09-11T12:00:00Z'),
      updatedAt: new Date('2026-09-11T12:00:00Z'),
      resolvedAt: null,
    })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(() => queryBuilder({})),
    ...extra,
  };
}

describe('ReportsService', () => {
  let service: ReportsService;
  let reports: ReturnType<typeof repo>;
  let attempts: ReturnType<typeof repo>;
  let comments: ReturnType<typeof repo>;
  let enrolments: ReturnType<typeof repo>;
  let templates: ReturnType<typeof repo>;
  let items: ReturnType<typeof repo>;
  let purchases: ReturnType<typeof repo>;
  let clans: ReturnType<typeof repo>;
  let clanMembers: ReturnType<typeof repo>;
  let users: ReturnType<typeof repo>;
  let env: Record<string, string>;
  const feed = { removeComment: jest.fn() };
  const verdicts = { unpublish: jest.fn() };
  const discipline = { flagCheater: jest.fn(), reinstate: jest.fn() };
  const taskTemplates = { retire: jest.fn() };
  const shop = { update: jest.fn() };
  const notifications = { notify: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    env = {};
    reports = repo();
    attempts = repo();
    comments = repo();
    enrolments = repo();
    templates = repo();
    items = repo();
    purchases = repo();
    clans = repo();
    clanMembers = repo();
    users = repo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(GameReport), useValue: reports },
        { provide: getRepositoryToken(GameAttempt), useValue: attempts },
        { provide: getRepositoryToken(GameAttemptComment), useValue: comments },
        { provide: getRepositoryToken(GameEnrolment), useValue: enrolments },
        { provide: getRepositoryToken(GameTaskTemplate), useValue: templates },
        { provide: getRepositoryToken(GameShopItem), useValue: items },
        { provide: getRepositoryToken(GamePurchase), useValue: purchases },
        { provide: getRepositoryToken(GameClan), useValue: clans },
        { provide: getRepositoryToken(GameClanMember), useValue: clanMembers },
        { provide: getRepositoryToken(User), useValue: users },
        {
          provide: SeasonsService,
          useValue: { current: jest.fn().mockResolvedValue(SEASON) },
        },
        { provide: FeedService, useValue: feed },
        { provide: VerdictsService, useValue: verdicts },
        { provide: DisciplineService, useValue: discipline },
        { provide: TaskTemplatesService, useValue: taskTemplates },
        { provide: ShopService, useValue: shop },
        { provide: NotificationsService, useValue: notifications },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => env[key] },
        },
      ],
    }).compile();

    service = moduleRef.get(ReportsService);
  });

  // ---------------------------------------------------------------- filing --

  describe('create', () => {
    it('refuses a reason the target does not list', async () => {
      await expect(
        service.create(KATE, {
          targetType: 'shop_item',
          targetId: 'i1',
          reason: 'cheating',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(reports.save).not.toHaveBeenCalled();
    });

    it('refuses the twenty-first report of the day with a 429', async () => {
      reports.count.mockResolvedValue(20);
      await expect(
        service.create(KATE, {
          targetType: 'app',
          reason: 'bug',
        }),
      ).rejects.toMatchObject({ status: 429 } as Partial<HttpException>);
    });

    it('does not reveal an unpublished hand-in that is not the reporter’s', async () => {
      attempts.findOne.mockResolvedValue({
        id: 'a1',
        status: 'submitted',
        enrolment: { userId: OMAR.id, handle: 'omar' },
      });
      await expect(
        service.create(KATE, {
          targetType: 'attempt',
          targetId: 'a1',
          reason: 'cheating',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('tells someone reporting their own comment to delete it instead', async () => {
      comments.findOne.mockResolvedValue({
        id: 'c1',
        userId: KATE.id,
        authorHandle: 'kate',
        body: 'oops',
        attemptId: 'a1',
      });
      await expect(
        service.create(KATE, {
          targetType: 'comment',
          targetId: 'c1',
          reason: 'spam',
        }),
      ).rejects.toThrow(/delete it instead/);
    });

    it('lets a player appeal their own rejected hand-in, and nothing else about it', async () => {
      attempts.findOne.mockResolvedValue({
        id: 'a1',
        status: 'rejected',
        kind: 'video',
        day: 2,
        enrolmentId: 'e-kate',
        enrolment: { userId: KATE.id, handle: 'kate' },
        taskTemplate: { title: 'Wear every black thing', slug: 'black' },
        aiVerdict: { verdict: 'cheating' },
        rejectionReason: 'Looks staged.',
      });

      await expect(
        service.create(KATE, {
          targetType: 'attempt',
          targetId: 'a1',
          reason: 'cheating',
        }),
      ).rejects.toThrow(BadRequestException);

      const { report } = await service.create(KATE, {
        targetType: 'attempt',
        targetId: 'a1',
        reason: 'wrong_verdict',
        details: 'It was one take, in the street.',
      });

      expect(report.about).toBe('kate\'s video for "Wear every black thing"');
      const row = reports.save.mock.calls[0][0] as GameReport;
      expect(row).toMatchObject({
        targetUserId: KATE.id,
        reason: 'wrong_verdict',
        priority: 1,
        status: 'open',
        snapshot: expect.objectContaining({
          aiVerdict: 'cheating',
          rejectionReason: 'Looks staged.',
        }) as unknown,
      });
    });

    it('refuses a second open report on the same thing, from the query or the index', async () => {
      comments.findOne.mockResolvedValue({
        id: 'c1',
        userId: OMAR.id,
        authorHandle: 'omar',
        body: 'ugh',
        attemptId: 'a1',
      });

      reports.findOne.mockResolvedValueOnce(report());
      await expect(
        service.create(KATE, {
          targetType: 'comment',
          targetId: 'c1',
          reason: 'harassment',
        }),
      ).rejects.toThrow(ConflictException);

      reports.findOne.mockResolvedValueOnce(null);
      reports.save.mockRejectedValueOnce(
        Object.assign(new Error(), { code: '23505' }),
      );
      await expect(
        service.create(KATE, {
          targetType: 'comment',
          targetId: 'c1',
          reason: 'harassment',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('finds a person by the handle the feed shows, and refuses self-accusation', async () => {
      enrolments.findOne
        .mockResolvedValueOnce({
          id: 'e-omar',
          userId: OMAR.id,
          handle: 'Omar_',
          role: 'player',
          status: 'active',
        })
        .mockResolvedValueOnce({ id: 'e-kate', handle: 'kate' });
      users.findOne.mockResolvedValue(OMAR);

      const { report } = await service.create(KATE, {
        targetType: 'user',
        handle: 'omar_',
        reason: 'multiple_accounts',
        tags: ['weapons', 'bogus'],
      });
      expect(report.about).toBe('@Omar_');
      expect(report.tags).toEqual(['weapons']);
      expect(reports.save.mock.calls[0][0]).toMatchObject({
        targetId: OMAR.id,
        targetUserId: OMAR.id,
        reporterHandle: 'kate',
        priority: 2,
      });

      enrolments.findOne.mockResolvedValue({
        id: 'e-kate',
        userId: KATE.id,
        handle: 'kate',
      });
      users.findOne.mockResolvedValue(KATE);
      await expect(
        service.create(KATE, {
          targetType: 'user',
          handle: 'kate',
          reason: 'cheating',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('a report about the game carries no target and is never a duplicate', async () => {
      const { report, hidden } = await service.create(KATE, {
        targetType: 'app',
        reason: 'exploit',
        details: 'Declining before accepting does not burn a heart.',
        context: '/play',
      });
      expect(report.targetId).toBeNull();
      expect(report.about).toBe('the game');
      expect(hidden).toBe(false);
      expect(reports.findOne).not.toHaveBeenCalled();
      expect(reports.save.mock.calls[0][0]).toMatchObject({
        priority: 3,
        context: '/play',
      });
    });

    it('hides a hand-in once enough different people have reported it', async () => {
      env.GAME_REPORT_AUTO_HIDE = '2';
      attempts.findOne.mockResolvedValue({
        id: 'a1',
        status: 'published',
        kind: 'photo',
        day: 1,
        enrolmentId: 'e-omar',
        enrolment: { userId: OMAR.id, handle: 'omar' },
        taskTemplate: null,
      });
      const countQb = queryBuilder({ rawOne: { n: '2' } });
      const hideQb = queryBuilder({ affected: 1 });
      const bumpQb = queryBuilder({ affected: 2 });
      reports.createQueryBuilder
        .mockReturnValueOnce(countQb)
        .mockReturnValueOnce(bumpQb);
      attempts.createQueryBuilder.mockReturnValueOnce(hideQb);

      const { hidden } = await service.create(KATE, {
        targetType: 'attempt',
        targetId: 'a1',
        reason: 'sexual',
      });

      expect(hidden).toBe(true);
      expect(hideQb.set).toHaveBeenCalledWith({
        hiddenAt: expect.any(Function) as unknown,
      });
      expect(bumpQb.set).toHaveBeenCalledWith({ priority: 2 });
    });

    it('does not hide below the threshold, or when it is off', async () => {
      attempts.findOne.mockResolvedValue({
        id: 'a1',
        status: 'published',
        kind: 'photo',
        day: 1,
        enrolmentId: 'e-omar',
        enrolment: { userId: OMAR.id, handle: 'omar' },
        taskTemplate: null,
      });
      reports.createQueryBuilder.mockReturnValue(
        queryBuilder({ rawOne: { n: '4' } }),
      );
      expect(
        (
          await service.create(KATE, {
            targetType: 'attempt',
            targetId: 'a1',
            reason: 'spam',
          })
        ).hidden,
      ).toBe(false);

      env.GAME_REPORT_AUTO_HIDE = '0';
      reports.createQueryBuilder.mockReturnValue(
        queryBuilder({ rawOne: { n: '40' } }),
      );
      expect(
        (
          await service.create(ADMIN, {
            targetType: 'attempt',
            targetId: 'a1',
            reason: 'spam',
          })
        ).hidden,
      ).toBe(false);
      expect(attempts.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('withdraw', () => {
    it('only while it is still on the queue', async () => {
      reports.findOne.mockResolvedValue(report({ status: 'resolved' }));
      await expect(service.withdraw(KATE, 'r1')).rejects.toThrow(
        ConflictException,
      );

      reports.findOne.mockResolvedValue(report({ status: 'open' }));
      const view = await service.withdraw(KATE, 'r1');
      expect(view.status).toBe('withdrawn');
      expect(view.outcome).toBeNull();
    });
  });

  // ----------------------------------------------------------------- panel --

  describe('claim', () => {
    it('refuses one another admin holds, unless forced', async () => {
      reports.findOne.mockResolvedValue(
        report({ status: 'reviewing', assignedTo: 'u-other' }),
      );
      await expect(service.claim('r1', ADMIN)).rejects.toThrow(
        ConflictException,
      );
      const view = await service.claim('r1', ADMIN, { force: true });
      expect(view.assignedTo).toBe(ADMIN.id);
    });
  });

  describe('resolve', () => {
    it('a dismissal takes no action, and an action must fit the target', async () => {
      reports.findOne.mockResolvedValue(report());
      await expect(
        service.resolve('r1', ADMIN, {
          status: 'dismissed',
          action: 'remove_content',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resolve('r1', ADMIN, {
          status: 'resolved',
          action: 'retire_task',
        }),
      ).rejects.toThrow(/does not apply/);
      expect(reports.save).not.toHaveBeenCalled();
    });

    it('removes a comment through the feed, closes the siblings, tells everyone', async () => {
      reports.findOne.mockResolvedValue(report());
      reports.find.mockResolvedValue([
        report(),
        report({ id: 'r2', reporterId: 'u-third', reporterHandle: 'third' }),
      ]);

      const result = await service.resolve('r1', ADMIN, {
        status: 'resolved',
        action: 'remove_content',
        note: 'Slur.',
        reporterMessage: 'Thank you for flagging it.',
      });

      expect(feed.removeComment).toHaveBeenCalledWith(ADMIN, 'c1');
      expect(result.siblingsClosed).toBe(1);
      expect(result.report).toMatchObject({
        status: 'resolved',
        action: 'remove_content',
        outcome: 'action_taken',
        resolvedBy: ADMIN.id,
      });
      expect(reports.update).toHaveBeenCalledWith(
        { id: expect.anything() as unknown },
        expect.objectContaining({
          status: 'resolved',
          action: 'remove_content',
        }),
      );
      // Both reporters, and the author.
      const calls = notifications.notify.mock.calls as [
        string,
        string,
        string,
        string,
      ][];
      expect(calls.map((c) => c[0])).toEqual([KATE.id, 'u-third', OMAR.id]);
      expect(calls[0][3]).toContain('Thank you for flagging it.');
    });

    it('flags a cheater through discipline, naming the hand-in', async () => {
      reports.findOne.mockResolvedValue(
        report({
          targetType: 'attempt',
          targetId: 'a1',
          reason: 'cheating',
          snapshot: { handle: 'omar', kind: 'video' },
        }),
      );
      enrolments.findOne.mockResolvedValue({ id: 'e-omar', userId: OMAR.id });
      discipline.flagCheater.mockResolvedValue({
        id: 'e-omar',
        status: 'cheater',
      });

      const result = await service.resolve('r1', ADMIN, {
        status: 'resolved',
        action: 'flag_cheater',
        includeSiblings: false,
        notifyReporter: false,
      });

      expect(discipline.flagCheater).toHaveBeenCalledWith('e-omar', {
        attemptId: 'a1',
        by: ADMIN.id,
        reason: 'Reported: cheating.',
      });
      expect(result.actionResult).toEqual({
        enrolmentId: 'e-omar',
        status: 'cheater',
      });
      expect(notifications.notify).toHaveBeenCalledTimes(1);
      const [told] = notifications.notify.mock.calls[0] as [string];
      expect(told).toBe(OMAR.id);
    });

    it('leaves the report open when the action refuses', async () => {
      reports.findOne.mockResolvedValue(
        report({ targetType: 'attempt', targetId: 'a1' }),
      );
      attempts.findOne.mockResolvedValue({ id: 'a1', status: 'published' });
      verdicts.unpublish.mockRejectedValue(
        new ConflictException('not in feed'),
      );

      await expect(
        service.resolve('r1', ADMIN, {
          status: 'resolved',
          action: 'remove_content',
        }),
      ).rejects.toThrow(ConflictException);
      expect(reports.save).not.toHaveBeenCalled();
      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it('refuses to close a report twice', async () => {
      reports.findOne.mockResolvedValue(report({ status: 'dismissed' }));
      await expect(
        service.resolve('r1', ADMIN, { status: 'dismissed' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('get', () => {
    it('reads the thing as it is now, and both parties’ history', async () => {
      reports.findOne.mockResolvedValue(report());
      reports.find
        .mockResolvedValueOnce([report(), report({ id: 'r2' })]) // siblings
        .mockResolvedValueOnce([]) // target user: filed
        .mockResolvedValueOnce([
          report({ status: 'resolved', action: 'warn_user' }),
          report({ id: 'r2' }),
        ]) // target user: received
        .mockResolvedValueOnce([
          report(),
          report({ id: 'r3', status: 'dismissed' }),
        ]) // reporter: filed
        .mockResolvedValueOnce([]); // reporter: received
      reports.createQueryBuilder.mockReturnValue(
        queryBuilder({ rawOne: { n: '2' } }),
      );
      comments.findOne.mockResolvedValue({ id: 'c1', hiddenAt: new Date() });

      const detail = await service.get('r1');

      expect(detail.target).toEqual({
        exists: true,
        hidden: true,
        status: null,
        openReporters: 2,
      });
      expect(detail.siblings.map((s) => s.id)).toEqual(['r2']);
      expect(detail.targetUser).toMatchObject({
        received: 2,
        receivedUpheld: 1,
        receivedOpen: 1,
      });
      expect(detail.reporter).toMatchObject({
        filed: 2,
        filedDismissed: 1,
      });
      expect(detail.actions).toContain('remove_content');
    });
  });

  it('describes a report from its snapshot alone', () => {
    expect(describeTarget('comment', { handle: 'omar', body: 'ugh' })).toBe(
      'omar\'s comment "ugh"',
    );
    expect(describeTarget('task', { title: 'Sing to a stranger' })).toBe(
      'task "Sing to a stranger"',
    );
    expect(describeTarget('user', {})).toBe('@someone');
  });
});
