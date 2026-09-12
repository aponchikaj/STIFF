import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { NotificationsService } from '../../notifications/notifications.service';
import { User } from '../../users/user.entity';
import { DisciplineService } from '../discipline.service';
import { GameAttemptComment } from '../entities/game-attempt-comment.entity';
import { GameAttempt } from '../entities/game-attempt.entity';
import { GameClan, GameClanMember } from '../entities/game-clan.entity';
import { GameEnrolment } from '../entities/game-enrolment.entity';
import {
  GameReport,
  type ReportSnapshot,
} from '../entities/game-report.entity';
import { GamePurchase, GameShopItem } from '../entities/game-shop.entity';
import { GameTaskTemplate } from '../entities/game-task-template.entity';
import { FeedService } from '../feed.service';
import { SeasonsService } from '../seasons.service';
import { ShopService } from '../shop.service';
import { TaskTemplatesService } from '../task-templates.service';
import { VerdictsService } from '../verdicts.service';
import {
  ACTIONS_FOR_TARGET,
  ACTIONS_THAT_NOTIFY_TARGET,
  actionAllowed,
  autoHideThreshold,
  ESCALATED_PRIORITY,
  OPEN_STATUSES,
  priorityFor,
  reasonAllowed,
  reasonFor,
  reasonsFor,
  reportDailyCap,
  REPORT_TAGS,
  REPORT_TARGET_LABELS,
  REPORT_TARGET_TYPES,
  normaliseTags,
  type ClosingStatus,
  type ReportAction,
  type ReportPriority,
  type ReportStatus,
  type ReportTargetType,
} from './report-rules';

// -------------------------------------------------------------------- views --

/** What the reporter sees of their own report. No internal note, ever. */
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
  outcome: 'action_taken' | 'no_action' | null;
  reporterMessage: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

/** What the panel sees. Everything, plus what the row cannot know alone. */
export interface AdminReportView extends ReportView {
  seasonId: string | null;
  reporterId: string | null;
  reporterHandle: string;
  targetUserId: string | null;
  snapshot: ReportSnapshot;
  context: string | null;
  priority: ReportPriority;
  assignedTo: string | null;
  action: ReportAction | null;
  note: string | null;
  resolvedBy: string | null;
  updatedAt: string;
}

export interface ReportDetail {
  report: AdminReportView;
  /** The thing now — does it still exist, is it hidden. */
  target: TargetState;
  /** Every other report on the same thing, newest first. */
  siblings: AdminReportView[];
  /** The account it is about: how many reports it has drawn, and how many stuck. */
  targetUser: PartyStats | null;
  /** The reporter: how many they have filed, and how many were upheld. */
  reporter: PartyStats | null;
  /** What the panel may do about it. */
  actions: readonly ReportAction[];
}

export interface TargetState {
  exists: boolean;
  hidden: boolean;
  status: string | null;
  /** Distinct accounts with an open report on it. */
  openReporters: number;
}

export interface PartyStats {
  userId: string;
  /** As a reporter. `filedUpheld` closed with an action that was not `none`. */
  filed: number;
  filedUpheld: number;
  filedDismissed: number;
  /** As the person reported. */
  received: number;
  receivedUpheld: number;
  receivedOpen: number;
}

export interface ReportStats {
  byStatus: Record<ReportStatus, number>;
  openByTargetType: Record<ReportTargetType, number>;
  openByPriority: Record<'0' | '1' | '2' | '3', number>;
  openByReason: { reason: string; count: number }[];
  /** Seconds the oldest open report has waited. */
  oldestOpenSeconds: number | null;
  hidden: { attempts: number; comments: number };
  /** Things with the most distinct open reporters. */
  mostReported: {
    targetType: ReportTargetType;
    targetId: string;
    reporters: number;
    about: string;
  }[];
}

interface ResolvedTarget {
  targetId: string | null;
  targetUserId: string | null;
  /** Whether the reporter owns it — an appeal rather than a report. */
  own: boolean;
  snapshot: ReportSnapshot;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Reports: filed by anyone with an account, worked by the panel.
 *
 * The rules — what can be reported, for what, by whom, and what resolving
 * one may do — are `report-rules.ts`. This is the part that touches the
 * database and the other services: it looks the target up and keeps a copy
 * of it, refuses the second tap and the twenty-first report of the day,
 * hides a hand-in that enough different people have flagged, and when an
 * admin closes a report it performs the action through the service that
 * owns it (`VerdictsService.unpublish`, `DisciplineService.flagCheater`,
 * ...) rather than reimplementing any of them.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(GameReport)
    private readonly reportRepo: Repository<GameReport>,
    @InjectRepository(GameAttempt)
    private readonly attemptRepo: Repository<GameAttempt>,
    @InjectRepository(GameAttemptComment)
    private readonly commentRepo: Repository<GameAttemptComment>,
    @InjectRepository(GameEnrolment)
    private readonly enrolmentRepo: Repository<GameEnrolment>,
    @InjectRepository(GameTaskTemplate)
    private readonly templateRepo: Repository<GameTaskTemplate>,
    @InjectRepository(GameShopItem)
    private readonly itemRepo: Repository<GameShopItem>,
    @InjectRepository(GamePurchase)
    private readonly purchaseRepo: Repository<GamePurchase>,
    @InjectRepository(GameClan)
    private readonly clanRepo: Repository<GameClan>,
    @InjectRepository(GameClanMember)
    private readonly clanMemberRepo: Repository<GameClanMember>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly seasons: SeasonsService,
    private readonly feed: FeedService,
    private readonly verdicts: VerdictsService,
    private readonly discipline: DisciplineService,
    private readonly templates: TaskTemplatesService,
    private readonly shop: ShopService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  // ------------------------------------------------------------ catalogue --

  /** What the report sheet renders, per kind of thing. */
  catalogue() {
    return {
      targetTypes: REPORT_TARGET_TYPES.map((type) => ({
        type,
        label: REPORT_TARGET_LABELS[type],
        reasons: reasonsFor(type).map((r) => ({
          id: r.id,
          label: r.label,
          applies: r.applies,
        })),
      })),
      tags: REPORT_TAGS,
      dailyCap: reportDailyCap(this.config),
      autoHideThreshold: autoHideThreshold(this.config),
    };
  }

  // --------------------------------------------------------------- filing --

  async create(
    user: User,
    input: {
      targetType: ReportTargetType;
      targetId?: string;
      handle?: string;
      reason: string;
      details?: string;
      tags?: string[];
      context?: string;
    },
  ): Promise<{ report: ReportView; hidden: boolean }> {
    const reason = reasonFor(input.reason);
    if (!reason || !reasonsFor(input.targetType).includes(reason)) {
      throw new BadRequestException(
        `"${input.reason}" is not a reason for ${REPORT_TARGET_LABELS[
          input.targetType
        ].toLowerCase()}. One of: ${reasonsFor(input.targetType)
          .map((r) => r.id)
          .join(', ')}.`,
      );
    }

    await this.enforceDailyCap(user);

    const season = await this.seasons.current();
    const target = await this.resolveTarget(user, input, season?.id ?? null);

    if (!reasonAllowed(input.targetType, reason.id, target.own)) {
      throw new BadRequestException(
        target.own
          ? input.targetType === 'comment'
            ? 'That is your own comment — delete it instead.'
            : `You cannot report your own ${noun(input.targetType)} for that.`
          : `"${reason.id}" is only for something of your own.`,
      );
    }

    if (target.targetId) {
      const dup = await this.reportRepo.findOne({
        where: {
          reporterId: user.id,
          targetType: input.targetType,
          targetId: target.targetId,
          status: In([...OPEN_STATUSES]),
        },
      });
      if (dup) {
        throw new ConflictException(
          'You already reported this. It is waiting to be looked at.',
        );
      }
    }

    const enrolment = season
      ? await this.enrolmentRepo.findOne({
          where: { seasonId: season.id, userId: user.id },
        })
      : null;

    let saved: GameReport;
    try {
      saved = await this.reportRepo.save(
        this.reportRepo.create({
          seasonId: season?.id ?? null,
          reporterId: user.id,
          reporterHandle: enrolment?.handle ?? user.username,
          targetType: input.targetType,
          targetId: target.targetId,
          targetUserId: target.targetUserId,
          snapshot: target.snapshot,
          reason: reason.id,
          details: input.details?.trim() || null,
          tags: normaliseTags(input.tags),
          context: input.context?.trim() || null,
          priority: priorityFor(reason.id),
          status: 'open',
        }),
      );
    } catch (err) {
      // Two taps racing past the findOne above: the partial unique index
      // decides, and the second is the same 409 as if it had been seen.
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictException(
          'You already reported this. It is waiting to be looked at.',
        );
      }
      throw err;
    }

    const hidden = await this.escalate(saved);
    return { report: this.toView(saved), hidden };
  }

  /** The reporter's own, newest first. */
  async mine(user: User, limit = 50): Promise<ReportView[]> {
    const rows = await this.reportRepo.find({
      where: { reporterId: user.id },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return rows.map((r) => this.toView(r));
  }

  /** Taken back. Only while nobody has closed it; the row is kept. */
  async withdraw(user: User, id: string): Promise<ReportView> {
    const report = await this.reportRepo.findOne({
      where: { id, reporterId: user.id },
    });
    if (!report) throw new NotFoundException('Report not found');
    if (!OPEN_STATUSES.includes(report.status)) {
      throw new ConflictException('That report has already been closed.');
    }
    report.status = 'withdrawn';
    return this.toView(await this.reportRepo.save(report));
  }

  // ---------------------------------------------------------------- panel --

  async list(
    options: {
      status?: ReportStatus | 'queue' | 'closed' | 'all';
      targetType?: ReportTargetType;
      targetId?: string;
      targetUserId?: string;
      reporterId?: string;
      reason?: string;
      minPriority?: number;
      assignedTo?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ items: AdminReportView[]; total: number }> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const qb = this.reportRepo.createQueryBuilder('report');

    const status = options.status ?? 'queue';
    if (status === 'queue') {
      qb.andWhere('report.status IN (:...open)', { open: OPEN_STATUSES });
    } else if (status === 'closed') {
      qb.andWhere('report.status IN (:...closed)', {
        closed: ['resolved', 'dismissed', 'withdrawn'],
      });
    } else if (status !== 'all') {
      qb.andWhere('report.status = :status', { status });
    }
    if (options.targetType) {
      qb.andWhere('report.targetType = :targetType', {
        targetType: options.targetType,
      });
    }
    if (options.targetId) {
      qb.andWhere('report.targetId = :targetId', {
        targetId: options.targetId,
      });
    }
    if (options.targetUserId) {
      qb.andWhere('report.targetUserId = :targetUserId', {
        targetUserId: options.targetUserId,
      });
    }
    if (options.reporterId) {
      qb.andWhere('report.reporterId = :reporterId', {
        reporterId: options.reporterId,
      });
    }
    if (options.reason) {
      qb.andWhere('report.reason = :reason', { reason: options.reason });
    }
    if (options.minPriority !== undefined) {
      qb.andWhere('report.priority >= :minPriority', {
        minPriority: options.minPriority,
      });
    }
    if (options.assignedTo) {
      qb.andWhere('report.assignedTo = :assignedTo', {
        assignedTo: options.assignedTo,
      });
    }

    // Most urgent first, then oldest first: the person who reported at the
    // start of the day should not wait longest because five others came in
    // after them.
    const [rows, total] = await qb
      .orderBy('report.priority', 'DESC')
      .addOrderBy('report.createdAt', 'ASC')
      .skip(options.offset ?? 0)
      .take(limit)
      .getManyAndCount();

    return { items: rows.map((r) => this.toAdminView(r)), total };
  }

  async get(id: string): Promise<ReportDetail> {
    const report = await this.requireReport(id);
    const siblings =
      report.targetId === null
        ? []
        : await this.reportRepo.find({
            where: { targetType: report.targetType, targetId: report.targetId },
            order: { createdAt: 'DESC' },
            take: 50,
          });

    return {
      report: this.toAdminView(report),
      target: await this.targetState(report),
      siblings: siblings
        .filter((s) => s.id !== report.id)
        .map((s) => this.toAdminView(s)),
      targetUser: report.targetUserId
        ? await this.partyStats(report.targetUserId)
        : null,
      reporter: report.reporterId
        ? await this.partyStats(report.reporterId)
        : null,
      actions: ACTIONS_FOR_TARGET[report.targetType],
    };
  }

  /** An admin takes it. Refused if another admin already has, unless forced. */
  async claim(
    id: string,
    admin: User,
    options: { force?: boolean } = {},
  ): Promise<AdminReportView> {
    const report = await this.requireReport(id);
    if (!OPEN_STATUSES.includes(report.status)) {
      throw new ConflictException('That report has already been closed.');
    }
    if (
      report.status === 'reviewing' &&
      report.assignedTo &&
      report.assignedTo !== admin.id &&
      !options.force
    ) {
      throw new ConflictException(
        'Another admin is already looking at this report.',
      );
    }
    report.status = 'reviewing';
    report.assignedTo = admin.id;
    return this.toAdminView(await this.reportRepo.save(report));
  }

  async setPriority(id: string, priority: number): Promise<AdminReportView> {
    const report = await this.requireReport(id);
    report.priority = Math.min(Math.max(Math.round(priority), 0), 3) as
      0 | 1 | 2 | 3;
    return this.toAdminView(await this.reportRepo.save(report));
  }

  /**
   * Closes a report, performs the action, and tells the people involved.
   *
   * The action runs first: if unpublishing or flagging refuses, the report
   * stays open rather than being marked resolved over nothing. Sibling
   * reports on the same thing are closed the same way, because a comment
   * deleted for one reporter is deleted for all of them.
   */
  async resolve(
    id: string,
    admin: User,
    input: {
      status: ClosingStatus;
      action?: ReportAction;
      note?: string;
      reporterMessage?: string;
      includeSiblings?: boolean;
      notifyReporter?: boolean;
    },
  ): Promise<{
    report: AdminReportView;
    siblingsClosed: number;
    actionResult: Record<string, unknown> | null;
  }> {
    const report = await this.requireReport(id);
    if (!OPEN_STATUSES.includes(report.status)) {
      throw new ConflictException('That report has already been closed.');
    }

    const action: ReportAction = input.action ?? 'none';
    if (input.status === 'dismissed' && action !== 'none') {
      throw new BadRequestException(
        'A dismissed report takes no action. Resolve it instead.',
      );
    }
    if (!actionAllowed(report.targetType, action)) {
      throw new BadRequestException(
        `"${action}" does not apply to ${REPORT_TARGET_LABELS[
          report.targetType
        ].toLowerCase()}. One of: ${ACTIONS_FOR_TARGET[report.targetType].join(
          ', ',
        )}.`,
      );
    }

    const note = input.note?.trim() || null;
    const actionResult = await this.perform(report, action, admin, note);

    const now = new Date();
    const closing = {
      status: input.status,
      action,
      note,
      reporterMessage: input.reporterMessage?.trim() || null,
      resolvedBy: admin.id,
      resolvedAt: now,
      assignedTo: report.assignedTo ?? admin.id,
    };
    Object.assign(report, closing);
    const saved = await this.reportRepo.save(report);

    let siblings: GameReport[] = [];
    if ((input.includeSiblings ?? true) && report.targetId) {
      siblings = await this.reportRepo.find({
        where: {
          targetType: report.targetType,
          targetId: report.targetId,
          status: In([...OPEN_STATUSES]),
        },
      });
      siblings = siblings.filter((s) => s.id !== report.id);
      if (siblings.length > 0) {
        await this.reportRepo.update(
          { id: In(siblings.map((s) => s.id)) },
          { ...closing, assignedTo: admin.id },
        );
      }
    }

    if (input.notifyReporter ?? true) {
      for (const r of [saved, ...siblings]) {
        await this.tellReporter(
          r,
          input.status,
          action,
          closing.reporterMessage,
        );
      }
    }
    if (ACTIONS_THAT_NOTIFY_TARGET.includes(action) && report.targetUserId) {
      await this.tellTarget(report, action, note);
    }

    return {
      report: this.toAdminView(saved),
      siblingsClosed: siblings.length,
      actionResult,
    };
  }

  /** A closed report back on the queue — the call was wrong, or new evidence. */
  async reopen(id: string, admin: User): Promise<AdminReportView> {
    const report = await this.requireReport(id);
    if (OPEN_STATUSES.includes(report.status)) return this.toAdminView(report);
    Object.assign(report, {
      status: 'reviewing',
      assignedTo: admin.id,
      action: null,
      resolvedBy: null,
      resolvedAt: null,
    });
    return this.toAdminView(await this.reportRepo.save(report));
  }

  async stats(): Promise<ReportStats> {
    const statusRows = await this.reportRepo
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.status')
      .getRawMany<{ status: ReportStatus; count: string }>();
    const byStatus = {
      open: 0,
      reviewing: 0,
      resolved: 0,
      dismissed: 0,
      withdrawn: 0,
    };
    for (const row of statusRows) byStatus[row.status] = Number(row.count);

    const typeRows = await this.reportRepo
      .createQueryBuilder('r')
      .select('r.targetType', 'targetType')
      .addSelect('COUNT(*)', 'count')
      .where('r.status IN (:...open)', { open: OPEN_STATUSES })
      .groupBy('r.targetType')
      .getRawMany<{ targetType: ReportTargetType; count: string }>();
    const openByTargetType = Object.fromEntries(
      REPORT_TARGET_TYPES.map((t) => [t, 0]),
    ) as Record<ReportTargetType, number>;
    for (const row of typeRows) {
      openByTargetType[row.targetType] = Number(row.count);
    }

    const priorityRows = await this.reportRepo
      .createQueryBuilder('r')
      .select('r.priority', 'priority')
      .addSelect('COUNT(*)', 'count')
      .where('r.status IN (:...open)', { open: OPEN_STATUSES })
      .groupBy('r.priority')
      .getRawMany<{ priority: number; count: string }>();
    const openByPriority = { '0': 0, '1': 0, '2': 0, '3': 0 };
    for (const row of priorityRows) {
      const key = String(row.priority) as keyof typeof openByPriority;
      if (key in openByPriority) openByPriority[key] = Number(row.count);
    }

    const reasonRows = await this.reportRepo
      .createQueryBuilder('r')
      .select('r.reason', 'reason')
      .addSelect('COUNT(*)', 'count')
      .where('r.status IN (:...open)', { open: OPEN_STATUSES })
      .groupBy('r.reason')
      .orderBy('count', 'DESC')
      .limit(20)
      .getRawMany<{ reason: string; count: string }>();

    const oldest = await this.reportRepo.findOne({
      where: { status: In([...OPEN_STATUSES]) },
      order: { createdAt: 'ASC' },
      select: { id: true, createdAt: true },
    });

    const mostReportedRows = await this.reportRepo
      .createQueryBuilder('r')
      .select('r.targetType', 'targetType')
      .addSelect('r.targetId', 'targetId')
      .addSelect('COUNT(DISTINCT r.reporterId)', 'reporters')
      .addSelect('MAX(r.snapshot::text)', 'snapshot')
      .where('r.status IN (:...open)', { open: OPEN_STATUSES })
      .andWhere('r.targetId IS NOT NULL')
      .groupBy('r.targetType')
      .addGroupBy('r.targetId')
      .orderBy('reporters', 'DESC')
      .limit(10)
      .getRawMany<{
        targetType: ReportTargetType;
        targetId: string;
        reporters: string;
        snapshot: string | null;
      }>();

    return {
      byStatus,
      openByTargetType,
      openByPriority,
      openByReason: reasonRows.map((r) => ({
        reason: r.reason,
        count: Number(r.count),
      })),
      oldestOpenSeconds: oldest
        ? Math.max(
            0,
            Math.round((Date.now() - oldest.createdAt.getTime()) / 1000),
          )
        : null,
      hidden: {
        attempts: await this.attemptRepo.count({
          where: { hiddenAt: Not(IsNull()) },
        }),
        comments: await this.commentRepo.count({
          where: { hiddenAt: Not(IsNull()) },
        }),
      },
      mostReported: mostReportedRows.map((row) => ({
        targetType: row.targetType,
        targetId: row.targetId,
        reporters: Number(row.reporters),
        about: describe(row.targetType, parseSnapshot(row.snapshot)),
      })),
    };
  }

  // -------------------------------------------------------------- targets --

  /**
   * Finds the thing, decides whose it is, and copies what matters.
   *
   * A 404 here is deliberate for anything the reporter could not have seen:
   * an unpublished hand-in that is not theirs, a draft task, a draft shop
   * item, a purchase that is somebody else's. Reporting is not a way to
   * probe what exists.
   */
  private async resolveTarget(
    user: User,
    input: { targetType: ReportTargetType; targetId?: string; handle?: string },
    seasonId: string | null,
  ): Promise<ResolvedTarget> {
    const { targetType } = input;

    if (targetType === 'app') {
      if (input.targetId) {
        throw new BadRequestException(
          'A report about the game itself has no target id.',
        );
      }
      return { targetId: null, targetUserId: null, own: false, snapshot: {} };
    }

    if (targetType === 'user') {
      return this.resolveUser(user, input, seasonId);
    }

    if (!input.targetId) {
      throw new BadRequestException('targetId is required.');
    }
    const id = input.targetId;

    switch (targetType) {
      case 'attempt': {
        const attempt = await this.attemptRepo.findOne({
          where: { id },
          relations: { enrolment: true, taskTemplate: true },
        });
        const own = attempt?.enrolment?.userId === user.id;
        if (
          !attempt ||
          (!own && attempt.status !== 'published') ||
          attempt.status === 'awaiting_upload'
        ) {
          throw new NotFoundException('Not found');
        }
        return {
          targetId: attempt.id,
          targetUserId: attempt.enrolment?.userId ?? null,
          own,
          snapshot: {
            kind: attempt.kind,
            day: attempt.day,
            status: attempt.status,
            mediaUrl: attempt.mediaUrl,
            caption: attempt.caption,
            handle: attempt.enrolment?.handle ?? null,
            enrolmentId: attempt.enrolmentId,
            taskTitle: attempt.taskTemplate?.title ?? null,
            taskSlug: attempt.taskTemplate?.slug ?? null,
            aiVerdict: attempt.aiVerdict?.verdict ?? null,
            rejectionReason: attempt.rejectionReason,
          },
        };
      }
      case 'comment': {
        const comment = await this.commentRepo.findOne({ where: { id } });
        if (!comment) throw new NotFoundException('Not found');
        return {
          targetId: comment.id,
          targetUserId: comment.userId,
          own: comment.userId === user.id,
          snapshot: {
            body: comment.body,
            handle: comment.authorHandle,
            attemptId: comment.attemptId,
          },
        };
      }
      case 'task': {
        const task = await this.templateRepo.findOne({ where: { id } });
        if (!task || task.status === 'draft') {
          throw new NotFoundException('Not found');
        }
        return {
          targetId: task.id,
          targetUserId: null,
          own: false,
          snapshot: {
            slug: task.slug,
            title: task.title,
            tier: task.tier,
            mode: task.mode,
            status: task.status,
            brief: task.brief.slice(0, 500),
          },
        };
      }
      case 'shop_item': {
        const item = await this.itemRepo.findOne({ where: { id } });
        if (!item || item.status === 'draft') {
          throw new NotFoundException('Not found');
        }
        return {
          targetId: item.id,
          targetUserId: null,
          own: false,
          snapshot: {
            name: item.name,
            priceCoins: item.priceCoins,
            imageUrl: item.imageUrl,
            status: item.status,
          },
        };
      }
      case 'clan': {
        const clan = await this.clanRepo.findOne({ where: { id } });
        if (!clan) throw new NotFoundException('Not found');
        const leader = await this.clanMemberRepo.findOne({
          where: { clanId: clan.id, role: 'leader' },
          relations: { enrolment: true },
        });
        const members = await this.clanMemberRepo.find({
          where: { clanId: clan.id },
          relations: { enrolment: true },
        });
        return {
          targetId: clan.id,
          targetUserId: leader?.enrolment?.userId ?? null,
          own: members.some((m) => m.enrolment?.userId === user.id),
          snapshot: {
            name: clan.name,
            status: clan.status,
            seasonId: clan.seasonId,
            members: members.map((m) => ({
              role: m.role,
              handle: m.enrolment?.handle ?? null,
            })),
          },
        };
      }
      case 'purchase': {
        // Only one's own. Somebody else's purchase is not a thing to see.
        const purchase = await this.purchaseRepo.findOne({
          where: { id, userId: user.id },
        });
        if (!purchase) throw new NotFoundException('Not found');
        return {
          targetId: purchase.id,
          targetUserId: null,
          own: true,
          snapshot: {
            itemId: purchase.itemId,
            itemName: purchase.itemName,
            priceCoins: purchase.priceCoins,
            status: purchase.status,
            boughtAt: purchase.createdAt.toISOString(),
          },
        };
      }
    }
  }

  /** A person, by id or by the handle every screen shows. */
  private async resolveUser(
    reporter: User,
    input: { targetId?: string; handle?: string },
    seasonId: string | null,
  ): Promise<ResolvedTarget> {
    let enrolment: GameEnrolment | null = null;
    let target: User | null = null;

    if (input.targetId) {
      target = await this.userRepo.findOne({ where: { id: input.targetId } });
      if (target && seasonId) {
        enrolment = await this.enrolmentRepo.findOne({
          where: { seasonId, userId: target.id },
        });
      }
    } else if (input.handle) {
      // The handle on the feed is the season's snapshot, so that is looked
      // up first; a watcher who never enrolled comments under their username.
      if (seasonId) {
        enrolment = await this.enrolmentRepo.findOne({
          where: { seasonId, handle: ILike(input.handle) },
        });
      }
      target = enrolment
        ? await this.userRepo.findOne({ where: { id: enrolment.userId } })
        : await this.userRepo.findOne({
            where: { username: ILike(input.handle) },
          });
    } else {
      throw new BadRequestException('Name the person: a targetId or a handle.');
    }

    if (!target) throw new NotFoundException('Not found');

    return {
      targetId: target.id,
      targetUserId: target.id,
      own: target.id === reporter.id,
      snapshot: {
        username: target.username,
        handle: enrolment?.handle ?? target.username,
        enrolmentId: enrolment?.id ?? null,
        role: enrolment?.role ?? null,
        status: enrolment?.status ?? null,
      },
    };
  }

  private async targetState(report: GameReport): Promise<TargetState> {
    const openReporters = report.targetId
      ? await this.distinctOpenReporters(report.targetType, report.targetId)
      : 0;
    const base = { exists: false, hidden: false, status: null, openReporters };
    if (!report.targetId) return { ...base, exists: true };

    switch (report.targetType) {
      case 'attempt': {
        const row = await this.attemptRepo.findOne({
          where: { id: report.targetId },
        });
        return row
          ? {
              ...base,
              exists: true,
              hidden: row.hiddenAt !== null,
              status: row.status,
            }
          : base;
      }
      case 'comment': {
        const row = await this.commentRepo.findOne({
          where: { id: report.targetId },
        });
        return row
          ? { ...base, exists: true, hidden: row.hiddenAt !== null }
          : base;
      }
      case 'user': {
        const row = await this.userRepo.findOne({
          where: { id: report.targetId },
        });
        if (!row) return base;
        const enrolment = report.seasonId
          ? await this.enrolmentRepo.findOne({
              where: { seasonId: report.seasonId, userId: row.id },
            })
          : null;
        return {
          ...base,
          exists: true,
          status: enrolment
            ? `${enrolment.role}/${enrolment.status}`
            : row.isBlocked
              ? 'blocked'
              : 'not enrolled',
        };
      }
      case 'task': {
        const row = await this.templateRepo.findOne({
          where: { id: report.targetId },
        });
        return row ? { ...base, exists: true, status: row.status } : base;
      }
      case 'shop_item': {
        const row = await this.itemRepo.findOne({
          where: { id: report.targetId },
        });
        return row ? { ...base, exists: true, status: row.status } : base;
      }
      case 'clan': {
        const row = await this.clanRepo.findOne({
          where: { id: report.targetId },
        });
        return row ? { ...base, exists: true, status: row.status } : base;
      }
      case 'purchase': {
        const row = await this.purchaseRepo.findOne({
          where: { id: report.targetId },
        });
        return row ? { ...base, exists: true, status: row.status } : base;
      }
      case 'app':
        return { ...base, exists: true };
    }
  }

  // ------------------------------------------------------------ escalation --

  /**
   * Hides a hand-in or a comment once enough *different* people have an
   * open report on it, and raises those reports so the queue shows them
   * first. Nothing else is touched: the verdict, the score, the counters
   * all stand until a person decides.
   */
  private async escalate(report: GameReport): Promise<boolean> {
    if (!report.targetId) return false;
    if (report.targetType !== 'attempt' && report.targetType !== 'comment') {
      return false;
    }
    const threshold = autoHideThreshold(this.config);
    if (threshold === 0) return false;

    const reporters = await this.distinctOpenReporters(
      report.targetType,
      report.targetId,
    );
    if (reporters < threshold) return false;

    const repo =
      report.targetType === 'attempt' ? this.attemptRepo : this.commentRepo;
    const hid = await (
      repo as Repository<{ id: string; hiddenAt: Date | null }>
    )
      .createQueryBuilder()
      .update()
      .set({ hiddenAt: () => 'now()' })
      .where('id = :id AND "hiddenAt" IS NULL', { id: report.targetId })
      .execute();

    await this.reportRepo
      .createQueryBuilder()
      .update()
      .set({ priority: ESCALATED_PRIORITY })
      .where(
        '"targetType" = :targetType AND "targetId" = :targetId AND "status" IN (:...open) AND "priority" < :priority',
        {
          targetType: report.targetType,
          targetId: report.targetId,
          open: OPEN_STATUSES,
          priority: ESCALATED_PRIORITY,
        },
      )
      .execute();

    if ((hid.affected ?? 0) > 0) {
      this.logger.warn(
        `Hid ${report.targetType} ${report.targetId}: ${reporters} open reports`,
      );
    }
    return true;
  }

  private async distinctOpenReporters(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<number> {
    const row = await this.reportRepo
      .createQueryBuilder('r')
      .select('COUNT(DISTINCT r.reporterId)', 'n')
      .where('r.targetType = :targetType', { targetType })
      .andWhere('r.targetId = :targetId', { targetId })
      .andWhere('r.status IN (:...open)', { open: OPEN_STATUSES })
      .getRawOne<{ n: string }>();
    return Number(row?.n ?? 0);
  }

  // --------------------------------------------------------------- actions --

  /** The action, through the service that owns it. Throws to keep the report open. */
  private async perform(
    report: GameReport,
    action: ReportAction,
    admin: User,
    note: string | null,
  ): Promise<Record<string, unknown> | null> {
    switch (action) {
      case 'none':
        return null;

      case 'remove_content': {
        if (!report.targetId) return null;
        if (report.targetType === 'comment') {
          await this.feed.removeComment(admin, report.targetId);
          return { removed: 'comment' };
        }
        const attempt = await this.attemptRepo.findOne({
          where: { id: report.targetId },
        });
        if (!attempt) throw new NotFoundException('That hand-in is gone.');
        if (attempt.status === 'published') {
          await this.verdicts.unpublish(attempt.id, { by: admin.id });
        }
        await this.attemptRepo.update({ id: attempt.id }, { hiddenAt: null });
        return {
          removed: 'attempt',
          wasPublished: attempt.status === 'published',
        };
      }

      case 'restore_content': {
        if (!report.targetId) return null;
        const repo =
          report.targetType === 'attempt' ? this.attemptRepo : this.commentRepo;
        const result = await (
          repo as Repository<{ id: string; hiddenAt: Date | null }>
        ).update({ id: report.targetId }, { hiddenAt: null });
        return { restored: (result.affected ?? 0) > 0 };
      }

      case 'warn_user':
        // The message itself is sent by `tellTarget`, after the row is closed.
        if (!report.targetUserId) {
          throw new BadRequestException('There is nobody to warn.');
        }
        return { warned: report.targetUserId };

      case 'flag_cheater': {
        const enrolment = await this.enrolmentOfTarget(report);
        const flagged = await this.discipline.flagCheater(enrolment.id, {
          attemptId:
            report.targetType === 'attempt'
              ? (report.targetId ?? undefined)
              : undefined,
          by: admin.id,
          reason: note ?? `Reported: ${report.reason}.`,
        });
        return { enrolmentId: flagged.id, status: flagged.status };
      }

      case 'reinstate': {
        const enrolment = await this.enrolmentOfTarget(report);
        const restored = await this.discipline.reinstate(enrolment.id, {
          restore: true,
          by: admin.id,
        });
        return { enrolmentId: restored.id, role: restored.role };
      }

      case 'retire_task': {
        if (!report.targetId) return null;
        const task = await this.templates.retire(report.targetId);
        return { slug: task.slug, status: task.status };
      }

      case 'archive_item': {
        if (!report.targetId) return null;
        const item = await this.shop.update(report.targetId, {
          status: 'archived',
        });
        return { name: item.name, status: item.status };
      }
    }
  }

  private async enrolmentOfTarget(report: GameReport): Promise<GameEnrolment> {
    if (!report.targetUserId) {
      throw new BadRequestException('This report is not about a person.');
    }
    const seasonId = report.seasonId ?? (await this.seasons.current())?.id;
    if (!seasonId) throw new BadRequestException('There is no season.');
    const enrolment = await this.enrolmentRepo.findOne({
      where: { seasonId, userId: report.targetUserId },
    });
    if (!enrolment) {
      throw new BadRequestException(
        'That person is not enrolled in this season.',
      );
    }
    return enrolment;
  }

  // -------------------------------------------------------- notifications --

  private async tellReporter(
    report: GameReport,
    status: ClosingStatus,
    action: ReportAction,
    message: string | null,
  ): Promise<void> {
    if (!report.reporterId) return;
    const about = describe(report.targetType, report.snapshot);
    const outcome =
      status === 'resolved' && action !== 'none'
        ? 'We looked into it and took action.'
        : status === 'resolved'
          ? 'We looked into it. No action was needed.'
          : 'We looked into it and did not find a problem.';
    await this.notify(
      report.reporterId,
      'Your report was reviewed',
      `${about}: ${outcome}${message ? ` ${message}` : ''}`,
      report.id,
    );
  }

  private async tellTarget(
    report: GameReport,
    action: ReportAction,
    note: string | null,
  ): Promise<void> {
    if (!report.targetUserId) return;
    const what: Record<string, string> = {
      warn_user: 'A warning about your conduct in the game.',
      remove_content:
        report.targetType === 'comment'
          ? 'One of your comments was removed after a report.'
          : 'One of your hand-ins was removed from the feed after a report.',
      flag_cheater:
        'Your account was flagged for cheating after a report. You can watch, but you cannot play.',
      reinstate: 'Your appeal was upheld. You are a player again.',
    };
    const body = what[action];
    if (!body) return;
    await this.notify(
      report.targetUserId,
      action === 'reinstate' ? 'Appeal upheld' : 'About your account',
      action === 'warn_user' && note ? `${body} ${note}` : body,
      report.id,
    );
  }

  /** Never throws: a notification that fails is a log line, not a lost resolution. */
  private async notify(
    userId: string,
    title: string,
    body: string,
    reportId: string,
  ): Promise<void> {
    try {
      await this.notifications.notify(userId, 'system', title, body, {
        targetType: 'report',
        targetId: reportId,
      });
    } catch (err) {
      this.logger.warn(
        `Could not notify ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ---------------------------------------------------------------- helpers --

  private async enforceDailyCap(user: User): Promise<void> {
    const cap = reportDailyCap(this.config);
    const since = new Date(Date.now() - DAY_MS);
    const filed = await this.reportRepo.count({
      where: { reporterId: user.id, createdAt: MoreThan(since) },
    });
    if (filed >= cap) {
      throw new HttpException(
        `You have filed ${cap} reports in the last day. Try again tomorrow.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async partyStats(userId: string): Promise<PartyStats> {
    const filedRows = await this.reportRepo.find({
      where: { reporterId: userId },
      select: { id: true, status: true, action: true },
      take: 1000,
    });
    const receivedRows = await this.reportRepo.find({
      where: { targetUserId: userId },
      select: { id: true, status: true, action: true },
      take: 1000,
    });
    const upheld = (rows: Pick<GameReport, 'status' | 'action'>[]) =>
      rows.filter((r) => r.status === 'resolved' && r.action !== 'none').length;
    return {
      userId,
      filed: filedRows.length,
      filedUpheld: upheld(filedRows),
      filedDismissed: filedRows.filter((r) => r.status === 'dismissed').length,
      received: receivedRows.length,
      receivedUpheld: upheld(receivedRows),
      receivedOpen: receivedRows.filter((r) => OPEN_STATUSES.includes(r.status))
        .length,
    };
  }

  private async requireReport(id: string): Promise<GameReport> {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  private toView(report: GameReport): ReportView {
    const closed =
      report.status === 'resolved' || report.status === 'dismissed';
    return {
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      about: describe(report.targetType, report.snapshot),
      reason: report.reason,
      reasonLabel: reasonFor(report.reason)?.label ?? report.reason,
      details: report.details,
      tags: report.tags ?? [],
      status: report.status,
      outcome: !closed
        ? null
        : report.status === 'resolved' &&
            report.action &&
            report.action !== 'none'
          ? 'action_taken'
          : 'no_action',
      reporterMessage: report.reporterMessage,
      createdAt: report.createdAt.toISOString(),
      resolvedAt: report.resolvedAt ? report.resolvedAt.toISOString() : null,
    };
  }

  private toAdminView(report: GameReport): AdminReportView {
    return {
      ...this.toView(report),
      seasonId: report.seasonId,
      reporterId: report.reporterId,
      reporterHandle: report.reporterHandle,
      targetUserId: report.targetUserId,
      snapshot: report.snapshot ?? {},
      context: report.context,
      priority: report.priority,
      assignedTo: report.assignedTo,
      action: report.action,
      note: report.note,
      resolvedBy: report.resolvedBy,
      updatedAt: report.updatedAt.toISOString(),
    };
  }
}

/** The label as a bare noun: "A hand-in" → "hand-in". */
function noun(targetType: ReportTargetType): string {
  return REPORT_TARGET_LABELS[targetType]
    .toLowerCase()
    .replace(/^(a|my|the) /, '');
}

/** One line that says what a report is about, from its snapshot. */
export function describe(
  targetType: ReportTargetType,
  snapshot: ReportSnapshot,
): string {
  const s = (key: string): string | null => {
    const v = snapshot[key];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  switch (targetType) {
    case 'attempt':
      return `${s('handle') ?? 'a player'}'s ${s('kind') ?? 'hand-in'}${
        s('taskTitle') ? ` for "${s('taskTitle')}"` : ''
      }`;
    case 'comment':
      return `${s('handle') ?? 'someone'}'s comment "${(s('body') ?? '').slice(0, 60)}"`;
    case 'user':
      return `@${s('handle') ?? s('username') ?? 'someone'}`;
    case 'task':
      return `task "${s('title') ?? s('slug') ?? '?'}"`;
    case 'shop_item':
      return `shop item "${s('name') ?? '?'}"`;
    case 'clan':
      return `clan "${s('name') ?? '?'}"`;
    case 'purchase':
      return `your purchase of "${s('itemName') ?? '?'}"`;
    case 'app':
      return 'the game';
  }
}

function parseSnapshot(raw: string | null): ReportSnapshot {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as ReportSnapshot)
      : {};
  } catch {
    return {};
  }
}
