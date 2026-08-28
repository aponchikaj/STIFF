import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  decompressInputLog,
  fromBase64,
  hashChart,
  replay,
  type Chart as ChartData,
  type InputEvent,
} from '@stiff/game-core';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { Chart } from './entities/chart.entity';
import { EconomyService, type MintOutcome } from './economy.service';
import { LeaderboardService } from './leaderboard.service';
import { Run } from './entities/run.entity';
import {
  RunRejection,
  type RejectionReason,
} from './entities/run-rejection.entity';
import { RunToken } from './entities/run-token.entity';

/** A run token is useless after this; the row is swept later. */
export const RUN_TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * A submission is refused when the wall clock says the player finished sooner
 * than the music could possibly have played. Slightly under 1 so that a fast
 * final note and ordinary clock skew do not punish an honest run.
 */
export const MIN_ELAPSED_RATIO = 0.95;

/**
 * Timing so consistent it is not a person.
 *
 * A human's errors are roughly Gaussian with a non-zero mean and a standard
 * deviation around 15–25ms. A bot reading the chart emits errors clustered at
 * zero. Ninety percent of hits inside ±2ms is not a very good player; it is
 * not a player.
 */
export const BOT_DELTA_MS = 2;
export const BOT_SHARE = 0.9;
/** Below this many hits the distribution says nothing, so the check abstains. */
export const BOT_MIN_SAMPLE = 20;

export class RunRejected extends Error {
  constructor(
    readonly reason: RejectionReason,
    readonly detail: Record<string, unknown>,
  ) {
    super(reason);
  }
}

/** A stored run plus what it earned — everything the results screen shows. */
export interface SubmittedRun extends Run {
  coinsAwarded: number;
  payoutReason: MintOutcome['reason'];
  isPersonalBest: boolean;
  balance: number;
}

export interface SubmitInput {
  runToken: string;
  /** Gzipped, delta-encoded input log, base64 for transport. */
  inputLog: string;
  clientScore: number;
  elapsedMs: number;
}

@Injectable()
export class RunsService {
  constructor(
    @InjectRepository(Chart) private readonly charts: Repository<Chart>,
    @InjectRepository(RunToken) private readonly tokens: Repository<RunToken>,
    @InjectRepository(Run) private readonly runs: Repository<Run>,
    @InjectRepository(RunRejection)
    private readonly rejections: Repository<RunRejection>,
    private readonly dataSource: DataSource,
    private readonly economy: EconomyService,
    private readonly leaderboard: LeaderboardService,
  ) {}

  /**
   * Opens a run.
   *
   * The chart hash is pinned here, not at submission, so that a chart edited
   * while someone is mid-song invalidates their run rather than scoring it
   * against notes they never saw.
   */
  async start(
    userId: string,
    chartId: string,
    practiceMode: boolean,
  ): Promise<{ runToken: string; chartHash: string; expiresAt: Date }> {
    const chart = await this.charts.findOne({ where: { id: chartId } });
    if (!chart) throw new NotFoundException('Chart not found');
    if (chart.status !== 'approved') {
      throw new BadRequestException('Chart is not published');
    }

    const token = this.tokens.create({
      id: randomUUID(),
      userId,
      chartId,
      chartHash: chart.chartHash,
      practiceMode,
      expiresAt: new Date(Date.now() + RUN_TOKEN_TTL_MS),
      consumedAt: null,
    });
    await this.tokens.save(token);

    return {
      runToken: token.id,
      chartHash: token.chartHash,
      expiresAt: token.expiresAt,
    };
  }

  /**
   * Scores a submission by replaying it, and keeps its own answer.
   *
   * The client's score is never stored. It is compared, and a mismatch is a
   * rejection — so the only thing a modified client can achieve is to have its
   * run refused.
   */
  async submit(userId: string, input: SubmitInput): Promise<SubmittedRun> {
    try {
      return await this.validateAndStore(userId, input);
    } catch (error) {
      if (error instanceof RunRejected) {
        await this.recordRejection(userId, input.runToken, error);
        throw new BadRequestException({
          message: 'Run rejected',
          reason: error.reason,
        });
      }
      throw error;
    }
  }

  private async validateAndStore(
    userId: string,
    input: SubmitInput,
  ): Promise<SubmittedRun> {
    const token = await this.tokens.findOne({
      where: { id: input.runToken },
    });
    if (!token || token.userId !== userId) {
      throw new RunRejected('token_unknown', { runToken: input.runToken });
    }
    if (token.consumedAt) {
      throw new RunRejected('token_reused', {
        consumedAt: token.consumedAt.toISOString(),
      });
    }
    if (token.expiresAt.getTime() < Date.now()) {
      throw new RunRejected('token_expired', {
        expiresAt: token.expiresAt.toISOString(),
      });
    }

    const chart = await this.charts.findOne({
      where: { id: token.chartId },
      relations: { song: true },
    });
    if (!chart) throw new NotFoundException('Chart no longer exists');

    // Recomputed, not trusted from the row: this is the check that a chart was
    // not edited underneath a run in progress.
    const chartData = toChartData(chart);
    const currentHash = await hashChart(chartData);
    if (currentHash !== token.chartHash) {
      throw new RunRejected('chart_hash_mismatch', {
        pinned: token.chartHash,
        current: currentHash,
      });
    }

    let events: InputEvent[];
    try {
      events = await decompressInputLog(fromBase64(input.inputLog));
    } catch (error) {
      throw new RunRejected('malformed_input_log', {
        error: error instanceof Error ? error.message : 'undecodable',
      });
    }

    const minElapsed = chart.song.durationMs * MIN_ELAPSED_RATIO;
    if (input.elapsedMs < minElapsed) {
      throw new RunRejected('too_fast', {
        elapsedMs: input.elapsedMs,
        requiredMs: Math.round(minElapsed),
      });
    }

    let result;
    try {
      result = replay(chartData, events, {
        noFail: token.practiceMode,
        songDurationMs: chart.song.durationMs,
      });
    } catch (error) {
      throw new RunRejected('malformed_input_log', {
        error: error instanceof Error ? error.message : 'unreplayable',
      });
    }

    // Exact, not approximate. Both sides run the same integer arithmetic, so
    // any difference at all means they were not scoring the same thing.
    if (result.score !== input.clientScore) {
      throw new RunRejected('score_mismatch', {
        client: input.clientScore,
        server: result.score,
      });
    }

    if (looksAutomated(result.deltas)) {
      throw new RunRejected('superhuman_consistency', {
        hits: result.deltas.length,
        withinBotWindow: result.deltas.filter(
          (d) => Math.abs(d) <= BOT_DELTA_MS,
        ).length,
      });
    }

    const payout = await this.economy.payoutConfig();

    // Consuming the token, writing the run, minting its coins and updating the
    // board all share one transaction. A crash anywhere in here must not leave
    // a run that was never paid, coins for a run that does not exist, or a
    // token that can be spent twice.
    return this.dataSource.transaction(async (manager) => {
      const consumed = await manager
        .createQueryBuilder()
        .update(RunToken)
        .set({ consumedAt: new Date() })
        .where('id = :id AND "consumedAt" IS NULL', { id: token.id })
        .execute();

      // Lost the race against a concurrent submission of the same token.
      if (consumed.affected === 0) {
        throw new RunRejected('token_reused', { runToken: token.id });
      }

      const run = manager.create(Run, {
        userId,
        chartId: chart.id,
        chartHash: token.chartHash,
        score: result.score,
        accuracy: result.accuracy,
        maxCombo: result.maxCombo,
        rank: result.failed ? 'F' : result.rank,
        judgements: result.counts,
        elapsedMs: input.elapsedMs,
        // A practice run is never authoritative — the schema refuses a row
        // that claims to be both.
        validated: !token.practiceMode,
        practiceMode: token.practiceMode,
        replayKey: null,
      });
      const saved = await manager.save(run);

      const mint = await this.economy.mintForRun(
        manager,
        saved,
        chart.difficulty,
        payout,
        await this.economy.clearsToday(manager, userId, chart.id),
        await this.economy.earnedToday(manager, userId),
      );

      // Only a validated, non-practice run reaches a board.
      const isPersonalBest =
        saved.validated && !saved.practiceMode
          ? await this.leaderboard.recordIfBest(manager, saved)
          : false;

      return {
        ...saved,
        coinsAwarded: mint.coins,
        payoutReason: mint.reason,
        isPersonalBest,
        balance: await this.economy.balance(userId, manager),
      };
    });
  }

  /** A player's own history. Newest first, capped — this feeds a results list. */
  async recentFor(userId: string): Promise<Run[]> {
    return this.runs.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
      relations: { chart: { song: true } },
    });
  }

  async oneFor(userId: string, id: string): Promise<Run> {
    const run = await this.runs.findOne({
      where: { id, userId },
      relations: { chart: { song: true } },
    });
    if (!run) throw new NotFoundException('Run not found');
    return run;
  }

  private async recordRejection(
    userId: string,
    runTokenId: string,
    rejected: RunRejected,
  ): Promise<void> {
    const token = await this.tokens.findOne({ where: { id: runTokenId } });
    await this.rejections.save(
      this.rejections.create({
        userId,
        chartId: token?.chartId ?? null,
        runTokenId: token?.id ?? null,
        reason: rejected.reason,
        detail: rejected.detail,
      }),
    );
  }
}

/** Rebuilds the shared `Chart` shape from the row the database gave back. */
export function toChartData(chart: Chart): ChartData {
  return {
    version: 1,
    songId: chart.songId,
    difficulty: chart.difficulty,
    bpmChanges: chart.bpmChanges,
    scrollSpeed: chart.scrollSpeed,
    notes: chart.notes,
    events: chart.events,
    meta: {
      generator: chart.generatedBy,
      npsPeak: chart.npsPeak,
      npsAvg: chart.npsAvg,
    },
  };
}

export function looksAutomated(deltas: readonly number[]): boolean {
  if (deltas.length < BOT_MIN_SAMPLE) return false;
  const tight = deltas.filter((d) => Math.abs(d) <= BOT_DELTA_MS).length;
  return tight / deltas.length > BOT_SHARE;
}
