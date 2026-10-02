import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { returnedRows } from '../common/utils/returned-rows';
import { EconomyService } from './economy.service';

/**
 * Moves bought opals from a finished season into the live one.
 *
 * Opals bought with money land on the season balance like earned coins —
 * spendable, zeroed by a cheating verdict, counted by the zero-balance
 * sweep — but unlike earned coins they are not forfeited when the season
 * closes. What carries is `LEAST(coins, paidOpals)`: bought opals are
 * treated as spent last, so an account that spent less than it bought
 * keeps the difference, and one that spent everything keeps nothing.
 *
 * Its own service rather than a method on `OpalsService` because
 * `EnrolmentsService` calls it on join, and `OpalsService` needs
 * `EnrolmentsService` — this keeps the dependency one-way.
 *
 * Idempotent: the source enrolment is claimed with a conditional UPDATE on
 * `opalsCarriedAt`, so two requests racing on the same join carry once.
 * Only **closed** seasons are carried from; an enrolment in a season that is
 * still open somewhere is still being played.
 */
@Injectable()
export class OpalCarryService {
  private readonly logger = new Logger(OpalCarryService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly economy: EconomyService,
  ) {}

  /**
   * Carries everything this account still holds in closed seasons into
   * `target`. Returns the opals moved; 0 when there was nothing to carry,
   * which is almost always.
   */
  async carryInto(
    userId: string,
    target: { id: string; seasonId: string },
  ): Promise<number> {
    const sources: { id: string }[] = await this.dataSource.query(
      `SELECT e."id"
         FROM "game_enrolments" e
         JOIN "game_seasons" s ON s."id" = e."seasonId"
        WHERE e."userId" = $1
          AND e."seasonId" <> $2
          AND e."paidOpals" > 0
          AND e."opalsCarriedAt" IS NULL
          AND s."status" = 'closed'`,
      [userId, target.seasonId],
    );
    if (sources.length === 0) return 0;

    const moved = await this.dataSource.transaction(async (manager) => {
      let total = 0;
      for (const source of sources) {
        const claimed = returnedRows(
          await manager.query(
            `UPDATE "game_enrolments"
                SET "opalsCarriedAt" = now(), "updatedAt" = now()
              WHERE "id" = $1 AND "opalsCarriedAt" IS NULL
              RETURNING LEAST("coins", "paidOpals") AS "amount"`,
            [source.id],
          ),
        ) as { amount: number | string }[];
        if (claimed.length === 0) continue;

        const amount = Math.max(0, Number(claimed[0].amount));
        if (amount === 0) continue;

        // Out of the old balance and into the new one, each with its own
        // ledger row pointing at the other side, so both seasons' ledgers
        // still sum to their balances.
        await this.economy.move(
          [source.id],
          {
            coins: -amount,
            reason: 'opal_carry',
            refType: 'enrolment',
            refId: target.id,
          },
          manager,
        );
        await this.economy.move(
          [target.id],
          {
            coins: amount,
            reason: 'opal_carry',
            refType: 'enrolment',
            refId: source.id,
          },
          manager,
        );
        // Still bought, so it can carry again from this season.
        await manager.query(
          `UPDATE "game_enrolments"
              SET "paidOpals" = "paidOpals" + $2
            WHERE "id" = $1`,
          [target.id, amount],
        );
        total += amount;
      }
      return total;
    });

    if (moved > 0) {
      this.logger.log(
        `Carried ${moved} bought opal(s) into enrolment ${target.id}.`,
      );
    }
    return moved;
  }
}
