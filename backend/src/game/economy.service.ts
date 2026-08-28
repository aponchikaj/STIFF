import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Difficulty } from '@stiff/game-core';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CoinLedgerEntry } from './entities/coin-ledger.entity';
import { EconomyConfig } from './entities/economy-config.entity';
import { Inventory } from './entities/inventory.entity';
import { Item } from './entities/item.entity';
import { Purchase } from './entities/purchase.entity';
import type { Rank, Run } from './entities/run.entity';

/**
 * Coins: where they come from, where they go, and why there is no balance
 * column anywhere.
 *
 * A wallet is `SUM(delta)` over `game_coin_ledger`. That is not purity for its
 * own sake — a mutable balance is the shape that loses money to a retried
 * request, and no amount of care at the call site fixes it. Every entry
 * carries a unique idempotency key, so the same run credits once and the same
 * checkout debits once however many times either is submitted.
 */

export interface PayoutConfig {
  base: Record<Difficulty, number>;
  rankMultiplier: Record<Rank, number>;
  /** Share paid for the nth clear of a chart today; the tail is 0. */
  diminishing: number[];
  dailyCapCoins: number;
}

export const DEFAULT_PAYOUT: PayoutConfig = {
  base: { easy: 20, normal: 35, hard: 60, extreme: 100 },
  rankMultiplier: { P: 1.5, S: 1.25, A: 1.1, B: 1, C: 0.75, D: 0, F: 0 },
  diminishing: [1, 1, 1, 0.5, 0.25, 0.1, 0],
  dailyCapCoins: 2000,
};

export interface MintOutcome {
  coins: number;
  /** Why it was what it was — shown on the results screen, so it is not magic. */
  reason:
    | 'paid'
    | 'practice'
    | 'unvalidated'
    | 'rank_too_low'
    | 'daily_cap'
    | 'farmed';
}

@Injectable()
export class EconomyService {
  constructor(
    @InjectRepository(CoinLedgerEntry)
    private readonly ledger: Repository<CoinLedgerEntry>,
    @InjectRepository(EconomyConfig)
    private readonly config: Repository<EconomyConfig>,
    @InjectRepository(Item) private readonly items: Repository<Item>,
    private readonly dataSource: DataSource,
  ) {}

  /** Tunables live in config rows so retuning is an admin action, not a deploy. */
  async payoutConfig(): Promise<PayoutConfig> {
    const rows = await this.config.find();
    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    return {
      base:
        (byKey.get('payout.base') as PayoutConfig['base']) ??
        DEFAULT_PAYOUT.base,
      rankMultiplier:
        (byKey.get(
          'payout.rankMultiplier',
        ) as PayoutConfig['rankMultiplier']) ?? DEFAULT_PAYOUT.rankMultiplier,
      diminishing:
        (byKey.get('payout.diminishing') as number[]) ??
        DEFAULT_PAYOUT.diminishing,
      dailyCapCoins:
        (byKey.get('payout.dailyCapCoins') as number) ??
        DEFAULT_PAYOUT.dailyCapCoins,
    };
  }

  /**
   * Mints for a run, inside the caller's transaction.
   *
   * Called from the same transaction that writes the run, so a crash cannot
   * leave a paid run unrecorded or a recorded run unpaid.
   */
  async mintForRun(
    manager: EntityManager,
    run: Run,
    difficulty: Difficulty,
    config: PayoutConfig,
    clearsToday: number,
    earnedToday: number,
  ): Promise<MintOutcome> {
    if (run.practiceMode) return { coins: 0, reason: 'practice' };
    if (!run.validated) return { coins: 0, reason: 'unvalidated' };

    const multiplier = config.rankMultiplier[run.rank] ?? 0;
    if (multiplier <= 0) return { coins: 0, reason: 'rank_too_low' };

    // Diminishing returns are indexed by how many times this chart has already
    // been cleared today, so the easiest chart cannot be farmed in a loop.
    const share =
      config.diminishing[
        Math.min(clearsToday, config.diminishing.length - 1)
      ] ?? 0;
    if (share <= 0) return { coins: 0, reason: 'farmed' };

    const base = config.base[difficulty] ?? 0;
    let coins = Math.round(base * multiplier * share);

    const remaining = config.dailyCapCoins - earnedToday;
    if (remaining <= 0) return { coins: 0, reason: 'daily_cap' };
    coins = Math.min(coins, remaining);
    if (coins <= 0) return { coins: 0, reason: 'daily_cap' };

    await manager.save(
      manager.create(CoinLedgerEntry, {
        userId: run.userId,
        delta: coins,
        reason: 'run_reward',
        refId: run.id,
        // The run id, so a double-submitted run credits exactly once.
        idempotencyKey: `run:${run.id}`,
        note: null,
        actorId: null,
      }),
    );

    return { coins, reason: 'paid' };
  }

  /**
   * The wallet.
   *
   * Recomputed rather than read from a column. An indexed sum over one
   * player's rows is single-digit milliseconds well past the point where any
   * of this matters, and it cannot drift.
   */
  async balance(userId: string, manager?: EntityManager): Promise<number> {
    const repo = manager?.getRepository(CoinLedgerEntry) ?? this.ledger;
    const row: { total: string | null } | undefined = await repo
      .createQueryBuilder('l')
      .select('COALESCE(SUM(l.delta), 0)', 'total')
      .where('l."userId" = :userId', { userId })
      .getRawOne();
    return Number(row?.total ?? 0);
  }

  /** How many times this chart has already paid out today, for the curve. */
  async clearsToday(
    manager: EntityManager,
    userId: string,
    chartId: string,
  ): Promise<number> {
    const { count } = (await manager
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('game_runs', 'r')
      .innerJoin(
        'game_coin_ledger',
        'l',
        `l."refId" = r.id AND l.reason = 'run_reward'`,
      )
      .where('r."userId" = :userId', { userId })
      .andWhere('r."chartId" = :chartId', { chartId })
      .andWhere(`l."createdAt" >= date_trunc('day', now())`)
      .getRawOne()) as { count: string };
    return Number(count ?? 0);
  }

  async earnedToday(manager: EntityManager, userId: string): Promise<number> {
    const { total } = (await manager
      .createQueryBuilder()
      .select('COALESCE(SUM(l.delta), 0)', 'total')
      .from('game_coin_ledger', 'l')
      .where('l."userId" = :userId', { userId })
      .andWhere('l.delta > 0')
      .andWhere(`l."createdAt" >= date_trunc('day', now())`)
      .getRawOne()) as { total: string };
    return Number(total ?? 0);
  }

  /**
   * Buying something.
   *
   * One transaction: the debit, the inventory row and the receipt either all
   * exist or none do. The balance is read *inside* it, so two concurrent
   * purchases cannot both see enough coins — the unique idempotency key is the
   * backstop when they race anyway.
   */
  async purchase(
    userId: string,
    itemId: string,
    idempotencyKey: string,
  ): Promise<{ item: Item; balance: number; alreadyOwned: boolean }> {
    const item = await this.items.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item not found');
    if (!item.isActive) throw new BadRequestException('Item is not for sale');

    const now = new Date();
    if (item.availableFrom && item.availableFrom > now) {
      throw new BadRequestException('Item is not available yet');
    }
    if (item.availableUntil && item.availableUntil < now) {
      throw new BadRequestException('Item is no longer available');
    }
    if (item.unlockCondition) {
      throw new BadRequestException('This item is earned, not bought');
    }

    return this.dataSource.transaction(async (manager) => {
      const owned = await manager.findOne(Inventory, {
        where: { userId, itemId },
      });
      if (owned) {
        // Not an error: a retried tap should be a no-op, not a second charge.
        return {
          item,
          balance: await this.balance(userId, manager),
          alreadyOwned: true,
        };
      }

      const balance = await this.balance(userId, manager);
      if (balance < item.priceCoins) {
        throw new BadRequestException({
          message: 'Not enough coins',
          balance,
          price: item.priceCoins,
        });
      }

      const entry = await manager.save(
        manager.create(CoinLedgerEntry, {
          userId,
          delta: -item.priceCoins,
          reason: 'purchase',
          refId: item.id,
          idempotencyKey,
          note: null,
          actorId: null,
        }),
      );

      await manager.save(
        manager.create(Inventory, { userId, itemId, source: 'purchase' }),
      );
      await manager.save(
        manager.create(Purchase, {
          userId,
          itemId,
          kind: 'item',
          priceCoins: item.priceCoins,
          ledgerEntryId: entry.id,
          orderId: null,
          idempotencyKey,
        }),
      );

      return {
        item,
        balance: balance - item.priceCoins,
        alreadyOwned: false,
      };
    });
  }
}
