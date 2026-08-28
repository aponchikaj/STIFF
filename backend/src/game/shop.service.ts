import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EconomyService } from './economy.service';
import { Inventory } from './entities/inventory.entity';
import { Item, type ItemType } from './entities/item.entity';
import { Loadout } from './entities/loadout.entity';
import { LeaderboardService } from './leaderboard.service';

/**
 * The shop, the locker and what a player owns.
 *
 * Buying is delegated to `EconomyService` because that is where the ledger
 * lives and a purchase is first of all a ledger entry; this class is the read
 * model and the equip logic around it.
 */
@Injectable()
export class ShopService {
  constructor(
    @InjectRepository(Item) private readonly items: Repository<Item>,
    @InjectRepository(Inventory)
    private readonly inventories: Repository<Inventory>,
    @InjectRepository(Loadout) private readonly loadouts: Repository<Loadout>,
    private readonly economy: EconomyService,
    private readonly leaderboards: LeaderboardService,
  ) {}

  /**
   * What is on sale right now.
   *
   * Availability windows are applied here rather than left to the client, so a
   * limited drop that has closed cannot be bought by anyone who kept the page
   * open.
   */
  async listItems() {
    const now = new Date();
    const rows = await this.items.find({ where: { isActive: true } });

    return rows
      .filter(
        (item) =>
          (!item.availableFrom || item.availableFrom <= now) &&
          (!item.availableUntil || item.availableUntil >= now),
      )
      .map((item) => ({
        id: item.id,
        slug: item.slug,
        name: item.name,
        description: item.description,
        type: item.type,
        rarity: item.rarity,
        priceCoins: item.priceCoins,
        // Non-null means it must be earned; price is then irrelevant.
        unlockCondition: item.unlockCondition,
        assetRefs: item.assetRefs,
        availableUntil: item.availableUntil,
      }));
  }

  async wallet(userId: string) {
    return { coins: await this.economy.balance(userId) };
  }

  async inventory(userId: string) {
    const [owned, equipped] = await Promise.all([
      this.inventories.find({ where: { userId }, relations: { item: true } }),
      this.loadouts.find({ where: { userId } }),
    ]);

    return {
      owned: owned.map((row) => ({
        itemId: row.itemId,
        slug: row.item?.slug,
        name: row.item?.name,
        type: row.item?.type,
        source: row.source,
        acquiredAt: row.acquiredAt,
      })),
      loadout: Object.fromEntries(
        equipped.map((row) => [row.slot, row.itemId]),
      ),
    };
  }

  async purchase(userId: string, itemId: string, idempotencyKey: string) {
    const result = await this.economy.purchase(userId, itemId, idempotencyKey);
    return {
      itemId: result.item.id,
      slug: result.item.slug,
      alreadyOwned: result.alreadyOwned,
      coins: result.balance,
    };
  }

  /**
   * Equipping.
   *
   * Two checks, both server-side: you must own it, and it must fit the slot.
   * The second is not pedantry — a note skin in the character slot would load
   * an atlas the renderer cannot use, and the failure would surface as a blank
   * screen mid-song rather than as an error here.
   */
  async equip(userId: string, slot: ItemType, itemId: string) {
    const owned = await this.inventories.findOne({
      where: { userId, itemId },
      relations: { item: true },
    });
    if (!owned) throw new BadRequestException('You do not own that item');
    if (owned.item.type !== slot) {
      throw new BadRequestException(
        `A ${owned.item.type} cannot go in the ${slot} slot`,
      );
    }

    const existing = await this.loadouts.findOne({ where: { userId, slot } });
    await this.loadouts.save(
      this.loadouts.create({ ...(existing ?? {}), userId, slot, itemId }),
    );

    return this.inventory(userId);
  }

  async leaderboard(chartId: string) {
    return { entries: await this.leaderboards.forChart(chartId) };
  }
}
