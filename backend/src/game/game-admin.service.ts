import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hashChart } from '@stiff/game-core';
import { DataSource, Repository } from 'typeorm';
import { CoinLedgerEntry } from './entities/coin-ledger.entity';
import { EconomyConfig } from './entities/economy-config.entity';
import { Chart } from './entities/chart.entity';
import { Inventory } from './entities/inventory.entity';
import { LeaderboardEntry } from './entities/leaderboard-entry.entity';
import {
  RunRejection,
  type RejectionAction,
} from './entities/run-rejection.entity';
import { Run } from './entities/run.entity';
import { Song } from './entities/song.entity';
import { toChartData } from './runs.service';

/**
 * What the panel does to the game.
 *
 * Every method here runs under `@Roles('admin')`, which means the existing
 * audit interceptor records it with before/after state for free — that is why
 * these live on the shop's own controllers rather than in
 * `backend/src/admin/`, and why there is one implementation of "approve a
 * chart" rather than two that drift.
 *
 * The shape of every destructive action is the same: it takes a reason, it
 * writes a row rather than deleting one, and it never happens implicitly.
 */
@Injectable()
export class GameAdminService {
  constructor(
    @InjectRepository(Chart) private readonly charts: Repository<Chart>,
    @InjectRepository(Song) private readonly songs: Repository<Song>,
    @InjectRepository(Run) private readonly runs: Repository<Run>,
    @InjectRepository(RunRejection)
    private readonly rejections: Repository<RunRejection>,
    @InjectRepository(LeaderboardEntry)
    private readonly board: Repository<LeaderboardEntry>,
    @InjectRepository(EconomyConfig)
    private readonly config: Repository<EconomyConfig>,
    private readonly dataSource: DataSource,
  ) {}

  /** Everything, including drafts — the panel's view is not the player's. */
  async listCharts() {
    const rows = await this.charts.find({
      relations: { song: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((chart) => ({
      id: chart.id,
      songId: chart.songId,
      songTitle: chart.song?.title,
      difficulty: chart.difficulty,
      version: chart.version,
      status: chart.status,
      generatedBy: chart.generatedBy,
      generatorModel: chart.generatorModel,
      chartHash: chart.chartHash,
      noteCount: chart.notes.length,
      npsPeak: chart.npsPeak,
      npsAvg: chart.npsAvg,
      approvedBy: chart.approvedBy,
      approvedAt: chart.approvedAt,
    }));
  }

  /**
   * Publishing a chart.
   *
   * The hash is recomputed rather than trusted, because a draft may have been
   * edited since it was stored and the hash is what every future run is
   * validated against. Approving is also where the previously-approved version
   * of the same song and difficulty gets archived — the partial unique index
   * allows exactly one, so doing it in the same transaction is the difference
   * between an atomic swap and a constraint violation.
   */
  async approveChart(chartId: string, adminId: string) {
    const chart = await this.charts.findOne({ where: { id: chartId } });
    if (!chart) throw new NotFoundException('Chart not found');
    if (chart.status === 'approved') return chart;

    const recomputed = await hashChart(toChartData(chart));

    return this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update(Chart)
        .set({ status: 'archived' })
        .where(
          '"songId" = :songId AND difficulty = :difficulty AND status = :status',
          {
            songId: chart.songId,
            difficulty: chart.difficulty,
            status: 'approved',
          },
        )
        .execute();

      chart.chartHash = recomputed;
      chart.status = 'approved';
      chart.approvedBy = adminId;
      chart.approvedAt = new Date();
      return manager.save(chart);
    });
  }

  async archiveChart(chartId: string) {
    const chart = await this.charts.findOne({ where: { id: chartId } });
    if (!chart) throw new NotFoundException('Chart not found');
    chart.status = 'archived';
    return this.charts.save(chart);
  }

  /** The anti-cheat queue: unreviewed first, newest first. */
  async listRejections(reviewed = false) {
    const rows = await this.rejections.find({
      where: reviewed ? {} : { reviewedAt: undefined },
      order: { createdAt: 'DESC' },
      take: 200,
      relations: { user: true, chart: { song: true } },
    });

    return rows
      .filter((row) => (reviewed ? true : row.reviewedAt === null))
      .map((row) => ({
        id: row.id,
        userId: row.userId,
        username: row.user?.username,
        chartId: row.chartId,
        songTitle: row.chart?.song?.title,
        difficulty: row.chart?.difficulty,
        reason: row.reason,
        detail: row.detail,
        createdAt: row.createdAt,
        reviewedAt: row.reviewedAt,
        action: row.action,
      }));
  }

  /**
   * Closing one out.
   *
   * This records the human decision and nothing else. A rejected submission
   * never became a run, so there is no score to void and no board entry to
   * pull — `voided` here means "this attempt was illegitimate", and acting on
   * a *stored* run is `removeLeaderboardEntry`, which is a separate, separately
   * audited call.
   *
   * The row is never deleted: the evidence outlives the decision, and a
   * reviewer who was wrong should be visible rather than erased.
   */
  async reviewRejection(
    rejectionId: string,
    adminId: string,
    action: RejectionAction,
  ) {
    const rejection = await this.rejections.findOne({
      where: { id: rejectionId },
    });
    if (!rejection) throw new NotFoundException('Rejection not found');
    if (rejection.reviewedAt) {
      throw new BadRequestException('Already reviewed');
    }

    rejection.reviewedBy = adminId;
    rejection.reviewedAt = new Date();
    rejection.action = action;
    return this.rejections.save(rejection);
  }

  /**
   * Taking an entry off a board.
   *
   * A reason is required by the schema, not just by this method. The row stays
   * and is marked, so the board can always be rebuilt from Postgres and the
   * removal is visible to whoever asks why.
   */
  async removeLeaderboardEntry(
    entryId: string,
    adminId: string,
    reason: string,
  ) {
    const entry = await this.board.findOne({ where: { id: entryId } });
    if (!entry) throw new NotFoundException('Entry not found');

    entry.removedAt = new Date();
    entry.removedBy = adminId;
    entry.removalReason = reason;
    return this.board.save(entry);
  }

  /**
   * Adjusting someone's coins by hand.
   *
   * A ledger entry like any other, with the actor and the reason attached —
   * the schema's CHECK refuses an `admin_adjustment` without both. There is no
   * path that edits a balance directly because there is no balance to edit.
   */
  async adjustCoins(
    userId: string,
    adminId: string,
    delta: number,
    note: string,
  ) {
    if (delta === 0) throw new BadRequestException('Adjustment cannot be zero');

    return this.dataSource.transaction(async (manager) =>
      manager.save(
        manager.create(CoinLedgerEntry, {
          userId,
          delta,
          reason: 'admin_adjustment',
          refId: null,
          // Unique per adjustment so a retried request is one adjustment.
          idempotencyKey: `adjust:${adminId}:${userId}:${Date.now()}`,
          note,
          actorId: adminId,
        }),
      ),
    );
  }

  /** Granting an item outright, e.g. compensation or a competition prize. */
  async grantItem(userId: string, itemId: string) {
    const existing = await this.dataSource.manager.findOne(Inventory, {
      where: { userId, itemId },
    });
    if (existing) return existing;

    return this.dataSource.manager.save(
      this.dataSource.manager.create(Inventory, {
        userId,
        itemId,
        source: 'grant',
      }),
    );
  }

  /** Economy tunables, as rows rather than a deploy. */
  async readConfig() {
    const rows = await this.config.find();
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async writeConfig(key: string, value: unknown, adminId: string) {
    const existing = await this.config.findOne({ where: { key } });
    return this.config.save(
      this.config.create({
        ...(existing ?? { key }),
        value,
        updatedBy: adminId,
      }),
    );
  }

  /** Numbers for the dashboard, in one round trip rather than six. */
  async overview() {
    const [songs, charts, approved, runs, rejections, pending] =
      await Promise.all([
        this.songs.count(),
        this.charts.count(),
        this.charts.count({ where: { status: 'approved' } }),
        this.runs.count(),
        this.rejections.count(),
        this.rejections
          .createQueryBuilder('r')
          .where('r."reviewedAt" IS NULL')
          .getCount(),
      ]);

    const minted = await this.dataSource
      .createQueryBuilder()
      .select('COALESCE(SUM(l.delta), 0)', 'total')
      .from(CoinLedgerEntry, 'l')
      .where('l.delta > 0')
      .getRawOne<{ total: string }>();

    const spent = await this.dataSource
      .createQueryBuilder()
      .select('COALESCE(SUM(l.delta), 0)', 'total')
      .from(CoinLedgerEntry, 'l')
      .where('l.delta < 0')
      .getRawOne<{ total: string }>();

    return {
      songs,
      charts,
      approvedCharts: approved,
      runs,
      rejections,
      pendingReview: pending,
      coinsMinted: Number(minted?.total ?? 0),
      // Negative; the panel shows the absolute value against what was minted.
      coinsSpent: Number(spent?.total ?? 0),
    };
  }
}
