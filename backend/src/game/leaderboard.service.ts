import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { LeaderboardEntry } from './entities/leaderboard-entry.entity';
import type { Run } from './entities/run.entity';

/**
 * Best run per player per chart.
 *
 * Postgres is the source of truth and, at the scale this launches at, also the
 * whole implementation — an indexed `(chartId, score DESC)` read answers a
 * top-100 in single-digit milliseconds well past ten thousand players. The
 * read path is written so a Redis mirror can be dropped in later without any
 * caller changing, and that mirror would be rebuilt from here rather than
 * patched, so a divergence always resolves in favour of this table.
 */
@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(LeaderboardEntry)
    private readonly entries: Repository<LeaderboardEntry>,
  ) {}

  /**
   * Records a run if it beats what the player already had.
   *
   * Runs inside the submission transaction. Only validated, non-practice runs
   * ever get here — the caller checks, and the schema refuses a row that
   * claims to be both practice and validated.
   *
   * The comparison is score, then accuracy as a tiebreak: two runs can reach
   * the same score with different note counts, and the cleaner one should win.
   */
  async recordIfBest(manager: EntityManager, run: Run): Promise<boolean> {
    const existing = await manager.findOne(LeaderboardEntry, {
      where: { chartId: run.chartId, userId: run.userId },
    });

    if (existing) {
      const better =
        run.score > existing.score ||
        (run.score === existing.score && run.accuracy > existing.accuracy);
      if (!better) return false;

      existing.runId = run.id;
      existing.score = run.score;
      existing.accuracy = run.accuracy;
      existing.maxCombo = run.maxCombo;
      existing.rank = run.rank;
      existing.achievedAt = run.createdAt ?? new Date();
      // A new personal best clears any previous removal: the entry being
      // replaced is not the one an admin took down.
      existing.removedAt = null;
      existing.removedBy = null;
      existing.removalReason = null;
      await manager.save(existing);
      return true;
    }

    await manager.save(
      manager.create(LeaderboardEntry, {
        chartId: run.chartId,
        userId: run.userId,
        runId: run.id,
        score: run.score,
        accuracy: run.accuracy,
        maxCombo: run.maxCombo,
        rank: run.rank,
        achievedAt: run.createdAt ?? new Date(),
      }),
    );
    return true;
  }

  /** One chart's board, best first. Removed entries never appear. */
  async forChart(chartId: string, limit = 100) {
    const rows = await this.entries.find({
      where: { chartId },
      order: { score: 'DESC', achievedAt: 'ASC' },
      take: limit,
      relations: { user: true },
    });

    return rows
      .filter((row) => row.removedAt === null)
      .map((row, index) => ({
        position: index + 1,
        userId: row.userId,
        username: row.user?.username ?? 'unknown',
        score: row.score,
        accuracy: row.accuracy,
        maxCombo: row.maxCombo,
        rank: row.rank,
        achievedAt: row.achievedAt,
      }));
  }

  /** Where one player stands on one chart, without fetching the whole board. */
  async positionFor(chartId: string, userId: string): Promise<number | null> {
    const mine = await this.entries.findOne({ where: { chartId, userId } });
    if (!mine || mine.removedAt !== null) return null;

    const ahead = await this.entries
      .createQueryBuilder('e')
      .where('e."chartId" = :chartId', { chartId })
      .andWhere('e."removedAt" IS NULL')
      .andWhere(
        '(e.score > :score OR (e.score = :score AND e."achievedAt" < :at))',
        {
          score: mine.score,
          at: mine.achievedAt,
        },
      )
      .getCount();

    return ahead + 1;
  }
}
