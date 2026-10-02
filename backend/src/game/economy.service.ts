import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { returnedRows } from '../common/utils/returned-rows';
import { NotificationsService } from '../notifications/notifications.service';
import {
  GameCoinLedger,
  type CoinReason,
} from './entities/game-coin-ledger.entity';
import { GameEnrolment } from './entities/game-enrolment.entity';
import {
  GameScoreLedger,
  SCORE_REASONS,
  type ScoreReason,
} from './entities/game-score-ledger.entity';

/** What one movement did to one enrolment. */
export interface CoinMovement {
  enrolmentId: string;
  userId: string;
  /** What actually moved — a penalty on an empty balance moves nothing. */
  coinsDelta: number;
  coinsAfter: number;
  nerveDelta: number;
  nerveAfter: number;
}

export interface Movement {
  /** Positive to award, negative to charge. Charged coins floor at zero. */
  coins: number;
  /**
   * Positive to award, negative to take back. Taken Nerve floors at zero,
   * and what actually moved is what the score ledger records.
   */
  nerve?: number;
  reason: CoinReason;
  /**
   * What the score ledger calls it, when that differs from the coin reason —
   * a clawback moves no coins, so it has no coin reason to borrow. Defaults
   * to `reason` when that is a score reason too, else `admin`.
   */
  scoreReason?: ScoreReason;
  refType?: string;
  refId?: string;
  /** Who moved it: `ai`, `resolver`, `sweep`, an admin's id. */
  by?: string;
}

/**
 * Coins and score, moved together and written down.
 *
 * One statement per movement, per batch: the enrolment rows are locked,
 * updated, and the *actual* change per row comes back — so a three-coin
 * penalty on a one-coin balance records -1, and nobody's coins go below
 * zero. The ledger rows are written in the same transaction, with the
 * balance after, so the running total on the enrolment can always be
 * checked against the sum of the ledger — coins against `game_coin_ledger`,
 * Nerve against `game_score_ledger`.
 *
 * Nerve moves `lastScoredAt` only when it goes up, because the board breaks
 * ties on who *reached* a score first; a clawback does not make someone
 * newer to the score they are left with.
 */
@Injectable()
export class EconomyService {
  private readonly logger = new Logger(EconomyService.name);

  constructor(
    @InjectRepository(GameEnrolment)
    private readonly enrolmentRepo: Repository<GameEnrolment>,
    @InjectRepository(GameCoinLedger)
    private readonly ledgerRepo: Repository<GameCoinLedger>,
    @InjectRepository(GameScoreLedger)
    private readonly scoreLedgerRepo: Repository<GameScoreLedger>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  /** Applies one movement to every enrolment named. */
  async move(
    enrolmentIds: string[],
    movement: Movement,
    manager?: EntityManager,
  ): Promise<CoinMovement[]> {
    const ids = [...new Set(enrolmentIds)];
    if (ids.length === 0) return [];
    const coins = Math.round(movement.coins);
    const nerve = Math.round(movement.nerve ?? 0);
    if (coins === 0 && nerve === 0) return [];
    const scoreReason = scoreReasonFor(movement);

    const run = async (m: EntityManager): Promise<CoinMovement[]> => {
      const rows = returnedRows(
        await m.query(
          `WITH before AS (
             SELECT "id", "coins", "nerve"
               FROM "game_enrolments"
              WHERE "id" = ANY($1::uuid[])
              FOR UPDATE
           )
           UPDATE "game_enrolments" e
              SET "coins"        = GREATEST(e."coins" + $2, 0),
                  "nerve"        = GREATEST(e."nerve" + $3, 0),
                  "lastScoredAt" = CASE WHEN $3 > 0 THEN now() ELSE e."lastScoredAt" END,
                  "updatedAt"    = now()
             FROM before
            WHERE e."id" = before."id"
            RETURNING e."id", e."userId",
                      before."coins" AS "coinsBefore", e."coins" AS "coinsAfter",
                      before."nerve" AS "nerveBefore", e."nerve" AS "nerveAfter"`,
          [ids, coins, nerve],
        ),
      ) as {
        id: string;
        userId: string;
        coinsBefore: number;
        coinsAfter: number;
        nerveBefore: number;
        nerveAfter: number;
      }[];

      const moved: CoinMovement[] = rows.map((r) => ({
        enrolmentId: r.id,
        userId: r.userId,
        coinsDelta: r.coinsAfter - r.coinsBefore,
        coinsAfter: r.coinsAfter,
        nerveDelta: r.nerveAfter - r.nerveBefore,
        nerveAfter: r.nerveAfter,
      }));

      for (const row of moved) {
        if (row.coinsDelta !== 0) {
          await m.insert(GameCoinLedger, {
            enrolmentId: row.enrolmentId,
            delta: row.coinsDelta,
            balanceAfter: row.coinsAfter,
            reason: movement.reason,
            refType: movement.refType ?? null,
            refId: movement.refId ?? null,
          });
        }
        if (row.nerveDelta !== 0) {
          await m.insert(GameScoreLedger, {
            enrolmentId: row.enrolmentId,
            delta: row.nerveDelta,
            scoreAfter: row.nerveAfter,
            reason: scoreReason,
            refType: movement.refType ?? null,
            refId: movement.refId ?? null,
            by: movement.by ?? null,
          });
        }
      }
      return moved;
    };

    const moved = manager
      ? await run(manager)
      : await this.dataSource.transaction(run);

    if (moved.length > 0) {
      this.logger.log(
        `${movement.reason}: ${moved.length} enrolment(s), coins ${coins >= 0 ? '+' : ''}${coins}, nerve ${nerve >= 0 ? '+' : ''}${nerve}`,
      );
    }
    return moved;
  }

  /**
   * Takes coins the enrolment must actually have.
   *
   * Unlike `move`, this refuses rather than floors: a purchase on a balance
   * that cannot cover it is not a purchase. One statement, so two buys
   * racing on the last coins cannot both succeed.
   */
  async charge(
    enrolmentId: string,
    price: number,
    movement: Omit<Movement, 'coins' | 'nerve'>,
    manager?: EntityManager,
  ): Promise<CoinMovement> {
    const cost = Math.max(0, Math.round(price));
    const run = async (m: EntityManager): Promise<CoinMovement> => {
      const rows = returnedRows(
        await m.query(
          `UPDATE "game_enrolments"
              SET "coins" = "coins" - $2, "updatedAt" = now()
            WHERE "id" = $1 AND "coins" >= $2
            RETURNING "id", "userId", "coins", "nerve"`,
          [enrolmentId, cost],
        ),
      ) as { id: string; userId: string; coins: number; nerve: number }[];
      if (rows.length === 0) {
        throw new ConflictException('Not enough coins.');
      }
      const row = rows[0];
      if (cost > 0) {
        await m.insert(GameCoinLedger, {
          enrolmentId,
          delta: -cost,
          balanceAfter: row.coins,
          reason: movement.reason,
          refType: movement.refType ?? null,
          refId: movement.refId ?? null,
        });
      }
      return {
        enrolmentId: row.id,
        userId: row.userId,
        coinsDelta: -cost,
        coinsAfter: row.coins,
        nerveDelta: 0,
        nerveAfter: row.nerve,
      };
    };
    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  /** The coin ledger for one enrolment, newest first. */
  ledger(enrolmentId: string, limit = 50): Promise<GameCoinLedger[]> {
    return this.ledgerRepo.find({
      where: { enrolmentId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  /** The score ledger for one enrolment, newest first. */
  scoreLedger(enrolmentId: string, limit = 50): Promise<GameScoreLedger[]> {
    return this.scoreLedgerRepo.find({
      where: { enrolmentId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  /** Tells each person what moved. Best effort. */
  async announce(
    moved: CoinMovement[],
    title: string,
    body: (m: CoinMovement) => string,
  ): Promise<void> {
    for (const m of moved) {
      try {
        await this.notifications.notify(m.userId, 'system', title, body(m));
      } catch (err) {
        this.logger.warn(
          `Could not notify ${m.userId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  /** Read-only: the running total, for a view. */
  async balance(enrolmentId: string): Promise<number> {
    const row = await this.enrolmentRepo.findOne({
      where: { id: enrolmentId },
      select: { id: true, coins: true },
    });
    return row?.coins ?? 0;
  }
}

/** The score ledger's word for a movement. */
function scoreReasonFor(movement: Movement): ScoreReason {
  if (movement.scoreReason) return movement.scoreReason;
  return (SCORE_REASONS as readonly string[]).includes(movement.reason)
    ? (movement.reason as ScoreReason)
    : 'admin';
}
