import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { returnedRows, rowsAffected } from '../common/utils/returned-rows';
import { User } from '../users/user.entity';
import { EconomyService } from './economy.service';
import {
  GamePurchase,
  GameShopItem,
  type PurchaseStatus,
  type ShopItemStatus,
} from './entities/game-shop.entity';
import { EnrolmentsService } from './enrolments.service';

export interface ShopItemView {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCoins: number;
  /** Null is unlimited. */
  stock: number | null;
  perPersonLimit: number | null;
  /** How many the reader has bought; 0 for a signed-out reader. */
  bought: number;
  soldOut: boolean;
}

export interface PurchaseView {
  id: string;
  itemId: string;
  itemName: string;
  priceCoins: number;
  status: PurchaseStatus;
  note: string | null;
  createdAt: string;
}

/**
 * The coin shop.
 *
 * Players and watchers alike buy with the coins on their enrolment; the
 * items are whatever an admin listed from the panel. A purchase is one
 * transaction: the stock is decremented only if there is any, the coins
 * are charged only if there are enough, the purchase row and the ledger
 * row are written together — and if any step refuses, nothing moved.
 */
@Injectable()
export class ShopService {
  constructor(
    @InjectRepository(GameShopItem)
    private readonly itemRepo: Repository<GameShopItem>,
    @InjectRepository(GamePurchase)
    private readonly purchaseRepo: Repository<GamePurchase>,
    private readonly dataSource: DataSource,
    private readonly enrolmentsService: EnrolmentsService,
    private readonly economy: EconomyService,
  ) {}

  // -------------------------------------------------------------- buying --

  /** What is on sale, with how many the reader already has. */
  async list(user: User | null): Promise<ShopItemView[]> {
    const items = await this.itemRepo.find({
      where: { status: 'live' },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
      take: 200,
    });
    const bought = await this.boughtBy(
      user,
      items.map((i) => i.id),
    );
    return items.map((item) => this.view(item, bought.get(item.id) ?? 0));
  }

  async buy(user: User, itemId: string): Promise<PurchaseView> {
    const enrolment = await this.enrolmentsService.require(user);
    const item = await this.itemRepo.findOne({ where: { id: itemId } });
    if (!item || item.status !== 'live') {
      throw new NotFoundException('That item is not on sale.');
    }

    const purchase = await this.dataSource.transaction(async (manager) => {
      if (item.perPersonLimit !== null) {
        const owned = await manager.count(GamePurchase, {
          where: {
            itemId: item.id,
            enrolmentId: enrolment.id,
            status: In(['paid', 'fulfilled']),
          },
        });
        if (owned >= item.perPersonLimit) {
          throw new ConflictException(
            `You can only buy this ${item.perPersonLimit} time(s).`,
          );
        }
      }

      // The stock decrement carries its own condition, so two buyers of
      // the last one cannot both take it.
      const taken = rowsAffected(
        await manager.query(
          `UPDATE "game_shop_items"
              SET "stock" = CASE WHEN "stock" IS NULL THEN NULL ELSE "stock" - 1 END,
                  "updatedAt" = now()
            WHERE "id" = $1 AND "status" = 'live'
              AND ("stock" IS NULL OR "stock" > 0)
            RETURNING "id"`,
          [item.id],
        ),
      );
      if (taken === 0) throw new ConflictException('Sold out.');

      const row = manager.create(GamePurchase, {
        itemId: item.id,
        enrolmentId: enrolment.id,
        userId: user.id,
        itemName: item.name,
        priceCoins: item.priceCoins,
        status: 'paid',
        note: null,
      });
      const saved = await manager.save(row);

      // Refuses on a short balance and rolls the stock back with it.
      await this.economy.charge(
        enrolment.id,
        item.priceCoins,
        { reason: 'purchase', refType: 'purchase', refId: saved.id },
        manager,
      );
      return saved;
    });

    return purchaseView(purchase);
  }

  async mine(user: User): Promise<PurchaseView[]> {
    const enrolment = await this.enrolmentsService.require(user);
    const rows = await this.purchaseRepo.find({
      where: { enrolmentId: enrolment.id },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return rows.map(purchaseView);
  }

  // ------------------------------------------------------------- admin --

  listAll(options: { status?: ShopItemStatus } = {}): Promise<GameShopItem[]> {
    const where: Record<string, unknown> = {};
    if (options.status) where.status = options.status;
    return this.itemRepo.find({
      where,
      order: { status: 'ASC', sortOrder: 'ASC', createdAt: 'DESC' },
      take: 500,
    });
  }

  async create(
    input: {
      name: string;
      description?: string;
      imageUrl?: string;
      priceCoins: number;
      stock?: number | null;
      perPersonLimit?: number | null;
      status?: ShopItemStatus;
      sortOrder?: number;
    },
    admin: User,
  ): Promise<GameShopItem> {
    return this.itemRepo.save(
      this.itemRepo.create({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        imageUrl: input.imageUrl?.trim() || null,
        priceCoins: Math.max(0, Math.round(input.priceCoins)),
        stock: input.stock ?? null,
        perPersonLimit: input.perPersonLimit ?? null,
        status: input.status ?? 'draft',
        sortOrder: input.sortOrder ?? 0,
        createdBy: admin.id,
      }),
    );
  }

  async update(
    id: string,
    input: Partial<{
      name: string;
      description: string | null;
      imageUrl: string | null;
      priceCoins: number;
      stock: number | null;
      perPersonLimit: number | null;
      status: ShopItemStatus;
      sortOrder: number;
    }>,
  ): Promise<GameShopItem> {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');
    if (input.name !== undefined) item.name = input.name.trim();
    if (input.description !== undefined) {
      item.description = input.description?.trim() || null;
    }
    if (input.imageUrl !== undefined) {
      item.imageUrl = input.imageUrl?.trim() || null;
    }
    if (input.priceCoins !== undefined) {
      item.priceCoins = Math.max(0, Math.round(input.priceCoins));
    }
    if (input.stock !== undefined) item.stock = input.stock;
    if (input.perPersonLimit !== undefined) {
      item.perPersonLimit = input.perPersonLimit;
    }
    if (input.status !== undefined) item.status = input.status;
    if (input.sortOrder !== undefined) item.sortOrder = input.sortOrder;
    if (!item.name) throw new BadRequestException('An item needs a name.');
    return this.itemRepo.save(item);
  }

  /** Purchases for the panel, newest first. */
  async purchases(
    options: { status?: PurchaseStatus; itemId?: string; limit?: number } = {},
  ): Promise<GamePurchase[]> {
    const where: Record<string, unknown> = {};
    if (options.status) where.status = options.status;
    if (options.itemId) where.itemId = options.itemId;
    return this.purchaseRepo.find({
      where,
      relations: { enrolment: true },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(options.limit ?? 200, 1), 500),
    });
  }

  /** Marks a purchase handed over, or cancels and refunds it. */
  async setPurchaseStatus(
    id: string,
    status: 'fulfilled' | 'cancelled',
    note?: string,
  ): Promise<GamePurchase> {
    const purchase = await this.purchaseRepo.findOne({ where: { id } });
    if (!purchase) throw new NotFoundException('Purchase not found');
    if (purchase.status === status) return purchase;
    if (purchase.status === 'cancelled') {
      throw new ConflictException('That purchase was already cancelled.');
    }

    await this.dataSource.transaction(async (manager) => {
      const claimed = returnedRows(
        await manager.query(
          `UPDATE "game_purchases"
              SET "status" = $2, "note" = $3, "updatedAt" = now()
            WHERE "id" = $1 AND "status" <> 'cancelled'
            RETURNING "id"`,
          [id, status, note?.trim().slice(0, 500) || null],
        ),
      );
      if (claimed.length === 0) {
        throw new ConflictException('That purchase was already cancelled.');
      }
      if (status === 'cancelled') {
        // Coins back, stock back. The ledger says why.
        await this.economy.move(
          [purchase.enrolmentId],
          {
            coins: purchase.priceCoins,
            reason: 'admin',
            refType: 'purchase',
            refId: purchase.id,
          },
          manager,
        );
        await manager.query(
          `UPDATE "game_shop_items"
              SET "stock" = CASE WHEN "stock" IS NULL THEN NULL ELSE "stock" + 1 END
            WHERE "id" = $1`,
          [purchase.itemId],
        );
      }
    });

    const fresh = await this.purchaseRepo.findOne({ where: { id } });
    return fresh ?? purchase;
  }

  // ------------------------------------------------------------ helpers --

  private async boughtBy(
    user: User | null,
    itemIds: string[],
  ): Promise<Map<string, number>> {
    if (!user || itemIds.length === 0) return new Map();
    const rows = await this.purchaseRepo
      .createQueryBuilder('p')
      .select('p.itemId', 'itemId')
      .addSelect('count(*)::int', 'count')
      .where('p.userId = :userId', { userId: user.id })
      .andWhere('p.itemId IN (:...ids)', { ids: itemIds })
      .andWhere('p.status IN (:...statuses)', {
        statuses: ['paid', 'fulfilled'],
      })
      .groupBy('p.itemId')
      .getRawMany<{ itemId: string; count: number }>();
    return new Map(rows.map((r) => [r.itemId, Number(r.count)]));
  }

  private view(item: GameShopItem, bought: number): ShopItemView {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      imageUrl: item.imageUrl,
      priceCoins: item.priceCoins,
      stock: item.stock,
      perPersonLimit: item.perPersonLimit,
      bought,
      soldOut: item.stock !== null && item.stock <= 0,
    };
  }
}

function purchaseView(p: GamePurchase): PurchaseView {
  return {
    id: p.id,
    itemId: p.itemId,
    itemName: p.itemName,
    priceCoins: p.priceCoins,
    status: p.status,
    note: p.note,
    createdAt: new Date(p.createdAt).toISOString(),
  };
}
