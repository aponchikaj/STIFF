import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { User } from '../users/user.entity';
import { EconomyService } from './economy.service';
import { GamePurchase, GameShopItem } from './entities/game-shop.entity';
import { EnrolmentsService } from './enrolments.service';
import { ShopService } from './shop.service';

/**
 * The coin shop.
 *
 * A purchase is one transaction with three things that can refuse it —
 * the per-person limit, the stock, the balance — and if any of them does,
 * nothing else has moved. The stock and the balance are conditional
 * UPDATEs so two buyers of the last one cannot both take it.
 */

const BUYER = { id: 'u1', username: 'kate' } as User;
const ADMIN = { id: 'admin1', username: 'ops', role: 'admin' } as User;

function item(overrides: Partial<GameShopItem> = {}): GameShopItem {
  return {
    id: 'i1',
    name: 'Cap',
    description: 'A cap',
    imageUrl: null,
    priceCoins: 4,
    stock: 3,
    perPersonLimit: null,
    status: 'live',
    sortOrder: 0,
    createdBy: 'admin1',
    createdAt: new Date('2026-09-11T10:00:00.000Z'),
    updatedAt: new Date('2026-09-11T10:00:00.000Z'),
    ...overrides,
  };
}

function purchase(overrides: Partial<GamePurchase> = {}): GamePurchase {
  return {
    id: 'p1',
    itemId: 'i1',
    enrolmentId: 'e1',
    userId: 'u1',
    itemName: 'Cap',
    priceCoins: 4,
    status: 'paid',
    note: null,
    createdAt: new Date('2026-09-11T11:00:00.000Z'),
    updatedAt: new Date('2026-09-11T11:00:00.000Z'),
    ...overrides,
  } as GamePurchase;
}

/** A chainable query builder whose only terminal is `getRawMany`. */
function rawBuilder(rows: unknown[]) {
  const qb: Record<string, jest.Mock> = {};
  for (const name of [
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'addGroupBy',
  ]) {
    qb[name] = jest.fn(() => qb);
  }
  qb.getRawMany = jest.fn().mockResolvedValue(rows);
  return qb;
}

describe('ShopService', () => {
  let service: ShopService;
  let itemRepo: Record<string, jest.Mock>;
  let purchaseRepo: Record<string, jest.Mock>;
  let manager: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock };
  let enrolments: { require: jest.Mock };
  let economy: { charge: jest.Mock; move: jest.Mock };

  beforeEach(async () => {
    itemRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((e: unknown) => e),
      save: jest.fn((e: unknown) =>
        Promise.resolve({ id: 'i1', ...(e as object) }),
      ),
    };
    purchaseRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(() => rawBuilder([])),
    };
    manager = {
      count: jest.fn().mockResolvedValue(0),
      // The stock decrement: a returned row is the database saying there
      // was one to take.
      query: jest.fn().mockResolvedValue([{ id: 'i1' }]),
      create: jest.fn((_: unknown, e: unknown) => e),
      save: jest.fn((e: unknown) =>
        Promise.resolve({
          id: 'p1',
          createdAt: new Date('2026-09-11T11:00:00.000Z'),
          ...(e as object),
        }),
      ),
    };
    dataSource = {
      transaction: jest.fn((cb: (m: unknown) => Promise<unknown>) =>
        cb(manager),
      ),
    };
    enrolments = {
      require: jest
        .fn()
        .mockResolvedValue({ id: 'e1', role: 'player', coins: 10 }),
    };
    economy = {
      charge: jest.fn().mockResolvedValue({
        enrolmentId: 'e1',
        userId: 'u1',
        coinsDelta: -4,
        coinsAfter: 6,
        nerveDelta: 0,
        nerveAfter: 0,
      }),
      move: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopService,
        { provide: getRepositoryToken(GameShopItem), useValue: itemRepo },
        { provide: getRepositoryToken(GamePurchase), useValue: purchaseRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: EnrolmentsService, useValue: enrolments },
        { provide: EconomyService, useValue: economy },
      ],
    }).compile();

    service = module.get(ShopService);
  });

  describe('list', () => {
    it('shows live items only, in order', async () => {
      itemRepo.find.mockResolvedValue([item()]);
      const items = await service.list(null);
      const [options] = itemRepo.find.mock.calls[0] as [
        { where: { status: string }; order: Record<string, string> },
      ];
      expect(options.where).toEqual({ status: 'live' });
      expect(options.order).toEqual({ sortOrder: 'ASC', createdAt: 'DESC' });
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ id: 'i1', name: 'Cap', priceCoins: 4 });
    });

    it('reports nothing bought for a signed-out reader', async () => {
      itemRepo.find.mockResolvedValue([item()]);
      const items = await service.list(null);
      expect(items[0].bought).toBe(0);
      expect(purchaseRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('counts what the reader already has', async () => {
      itemRepo.find.mockResolvedValue([item(), item({ id: 'i2' })]);
      purchaseRepo.createQueryBuilder.mockReturnValue(
        rawBuilder([{ itemId: 'i2', count: '2' }]),
      );
      const items = await service.list(BUYER);
      expect(items.map((i) => i.bought)).toEqual([0, 2]);
    });

    it('marks an item with no stock left as sold out', async () => {
      itemRepo.find.mockResolvedValue([
        item({ stock: 0 }),
        item({ id: 'i2', stock: null }),
      ]);
      const items = await service.list(null);
      expect(items.map((i) => i.soldOut)).toEqual([true, false]);
    });
  });

  describe('buy', () => {
    beforeEach(() => {
      itemRepo.findOne.mockResolvedValue(item());
    });

    it('needs an enrolment of either side, not a player', async () => {
      await service.buy(BUYER, 'i1');
      expect(enrolments.require).toHaveBeenCalledWith(BUYER);
    });

    it('refuses an item that is missing, a draft or archived', async () => {
      itemRepo.findOne.mockResolvedValue(null);
      await expect(service.buy(BUYER, 'i1')).rejects.toThrow(NotFoundException);
      itemRepo.findOne.mockResolvedValue(item({ status: 'draft' }));
      await expect(service.buy(BUYER, 'i1')).rejects.toThrow(NotFoundException);
      itemRepo.findOne.mockResolvedValue(item({ status: 'archived' }));
      await expect(service.buy(BUYER, 'i1')).rejects.toThrow(NotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('refuses once the per-person limit is reached', async () => {
      itemRepo.findOne.mockResolvedValue(item({ perPersonLimit: 2 }));
      manager.count.mockResolvedValue(2);
      await expect(service.buy(BUYER, 'i1')).rejects.toThrow(/2 time/);
      expect(manager.query).not.toHaveBeenCalled();
      expect(economy.charge).not.toHaveBeenCalled();
    });

    it('does not count purchases when there is no limit', async () => {
      await service.buy(BUYER, 'i1');
      expect(manager.count).not.toHaveBeenCalled();
    });

    it('takes stock with a conditional statement', async () => {
      await service.buy(BUYER, 'i1');
      const [sql, params] = manager.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/\("stock" IS NULL OR "stock" > 0\)/);
      expect(sql).toMatch(/"status" = 'live'/);
      expect(params).toEqual(['i1']);
    });

    it('is sold out when the stock statement matches nothing, and charges nobody', async () => {
      manager.query.mockResolvedValue([]);
      await expect(service.buy(BUYER, 'i1')).rejects.toThrow(/Sold out/);
      expect(manager.save).not.toHaveBeenCalled();
      expect(economy.charge).not.toHaveBeenCalled();
    });

    it('snapshots the name and the price onto the purchase', async () => {
      await service.buy(BUYER, 'i1');
      expect(manager.create).toHaveBeenCalledWith(
        GamePurchase,
        expect.objectContaining({
          itemId: 'i1',
          enrolmentId: 'e1',
          userId: 'u1',
          itemName: 'Cap',
          priceCoins: 4,
          status: 'paid',
        }),
      );
    });

    it('charges the coins inside the same transaction, after the purchase row', async () => {
      await service.buy(BUYER, 'i1');
      expect(economy.charge).toHaveBeenCalledWith(
        'e1',
        4,
        { reason: 'purchase', refType: 'purchase', refId: 'p1' },
        manager,
      );
      const saveOrder = manager.save.mock.invocationCallOrder[0];
      const chargeOrder = economy.charge.mock.invocationCallOrder[0];
      expect(saveOrder).toBeLessThan(chargeOrder);
    });

    it('lets a short balance refuse the whole purchase', async () => {
      economy.charge.mockRejectedValue(
        new ConflictException('Not enough coins.'),
      );
      await expect(service.buy(BUYER, 'i1')).rejects.toThrow(
        /Not enough coins/,
      );
    });

    it('returns the purchase view', async () => {
      const result = await service.buy(BUYER, 'i1');
      expect(result).toMatchObject({
        id: 'p1',
        itemId: 'i1',
        itemName: 'Cap',
        priceCoins: 4,
        status: 'paid',
      });
    });
  });

  describe('mine', () => {
    it('lists the reader’s purchases newest first', async () => {
      purchaseRepo.find.mockResolvedValue([purchase()]);
      const result = await service.mine(BUYER);
      const [options] = purchaseRepo.find.mock.calls[0] as [
        { where: { enrolmentId: string }; order: { createdAt: string } },
      ];
      expect(options.where).toEqual({ enrolmentId: 'e1' });
      expect(options.order).toEqual({ createdAt: 'DESC' });
      expect(result[0]).toMatchObject({ id: 'p1', itemName: 'Cap' });
      expect(result[0].createdAt).toBe('2026-09-11T11:00:00.000Z');
    });
  });

  describe('admin: items', () => {
    it('creates a draft with unlimited stock by default, trimmed', async () => {
      await service.create({ name: '  Cap  ', priceCoins: 4.4 }, ADMIN);
      expect(itemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Cap',
          description: null,
          imageUrl: null,
          priceCoins: 4,
          stock: null,
          perPersonLimit: null,
          status: 'draft',
          sortOrder: 0,
          createdBy: 'admin1',
        }),
      );
    });

    it('never prices below zero', async () => {
      await service.create({ name: 'Free', priceCoins: -3 }, ADMIN);
      expect(itemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ priceCoins: 0 }),
      );
    });

    it('updates only what was sent, and null clears stock and limit', async () => {
      itemRepo.findOne.mockResolvedValue(item({ stock: 3, perPersonLimit: 1 }));
      const saved = await service.update('i1', {
        stock: null,
        perPersonLimit: null,
        status: 'archived',
      });
      expect(saved).toMatchObject({
        name: 'Cap',
        priceCoins: 4,
        stock: null,
        perPersonLimit: null,
        status: 'archived',
      });
    });

    it('404s an unknown item', async () => {
      await expect(service.update('nope', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses an empty name', async () => {
      itemRepo.findOne.mockResolvedValue(item());
      await expect(service.update('i1', { name: '   ' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lists everything for the panel, optionally by status', async () => {
      await service.listAll({ status: 'live' });
      const [options] = itemRepo.find.mock.calls[0] as [{ where: object }];
      expect(options.where).toEqual({ status: 'live' });
      await service.listAll();
      const [all] = itemRepo.find.mock.calls[1] as [{ where: object }];
      expect(all.where).toEqual({});
    });
  });

  describe('admin: purchases', () => {
    it('filters by status and item, capped', async () => {
      await service.purchases({ status: 'paid', itemId: 'i1', limit: 9999 });
      const [options] = purchaseRepo.find.mock.calls[0] as [
        { where: object; take: number },
      ];
      expect(options.where).toEqual({ status: 'paid', itemId: 'i1' });
      expect(options.take).toBe(500);
    });

    it('returns a purchase already in the asked state untouched', async () => {
      purchaseRepo.findOne.mockResolvedValue(purchase({ status: 'fulfilled' }));
      await service.setPurchaseStatus('p1', 'fulfilled');
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('refuses to touch a cancelled purchase', async () => {
      purchaseRepo.findOne.mockResolvedValue(purchase({ status: 'cancelled' }));
      await expect(
        service.setPurchaseStatus('p1', 'fulfilled'),
      ).rejects.toThrow(ConflictException);
    });

    it('404s an unknown purchase', async () => {
      await expect(
        service.setPurchaseStatus('nope', 'fulfilled'),
      ).rejects.toThrow(NotFoundException);
    });

    it('marks handed over with a guarded UPDATE and refunds nothing', async () => {
      purchaseRepo.findOne
        .mockResolvedValueOnce(purchase())
        .mockResolvedValueOnce(purchase({ status: 'fulfilled' }));
      manager.query.mockResolvedValue([{ id: 'p1' }]);
      const result = await service.setPurchaseStatus(
        'p1',
        'fulfilled',
        ' handed at desk ',
      );
      const [sql, params] = manager.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/"status" <> 'cancelled'/);
      expect(params).toEqual(['p1', 'fulfilled', 'handed at desk']);
      expect(economy.move).not.toHaveBeenCalled();
      expect(result.status).toBe('fulfilled');
    });

    it('cancelling refunds the coins through the ledger and puts the stock back', async () => {
      purchaseRepo.findOne
        .mockResolvedValueOnce(purchase())
        .mockResolvedValueOnce(purchase({ status: 'cancelled' }));
      manager.query.mockResolvedValue([{ id: 'p1' }]);
      await service.setPurchaseStatus('p1', 'cancelled');
      expect(economy.move).toHaveBeenCalledWith(
        ['e1'],
        { coins: 4, reason: 'admin', refType: 'purchase', refId: 'p1' },
        manager,
      );
      const [stockSql, stockParams] = manager.query.mock.calls[1] as [
        string,
        unknown[],
      ];
      expect(stockSql).toMatch(/"stock" \+ 1/);
      expect(stockParams).toEqual(['i1']);
    });

    it('loses the race to a cancellation gracefully', async () => {
      purchaseRepo.findOne.mockResolvedValue(purchase());
      manager.query.mockResolvedValue([]);
      await expect(
        service.setPurchaseStatus('p1', 'fulfilled'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
