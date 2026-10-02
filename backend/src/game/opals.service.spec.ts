import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { PaymentsService } from '../payments/payments.service';
import { User } from '../users/user.entity';
import { EconomyService } from './economy.service';
import { GameOpalOrder, GameOpalPack } from './entities/game-opal.entity';
import { EnrolmentsService } from './enrolments.service';
import { OpalsService } from './opals.service';

/**
 * Opals for money.
 *
 * The rules that matter: nothing is credited at checkout, only at the
 * pending → paid transition; that transition happens once however often it
 * is asked for; a provider that fails leaves a `failed` order rather than a
 * dangling `pending` one; and the opals go to the live season's balance.
 */

const BUYER = { id: 'u1', username: 'kate' } as User;
const ADMIN = { id: 'admin1', username: 'ops', role: 'admin' } as User;

function pack(overrides: Partial<GameOpalPack> = {}): GameOpalPack {
  return {
    id: 'p1',
    name: 'Handful',
    opals: 100,
    priceCents: 500,
    badge: null,
    status: 'live',
    sortOrder: 0,
    createdBy: 'admin1',
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
    updatedAt: new Date('2026-10-01T10:00:00.000Z'),
    ...overrides,
  };
}

function order(overrides: Partial<GameOpalOrder> = {}): GameOpalOrder {
  return {
    id: 'o1',
    userId: 'u1',
    enrolmentId: 'e1',
    packId: 'p1',
    packName: 'Handful',
    opals: 100,
    priceCents: 500,
    paymentMethod: 'card_tbc',
    status: 'pending',
    reference: null,
    testMode: false,
    paidAt: null,
    createdAt: new Date('2026-10-02T10:00:00.000Z'),
    updatedAt: new Date('2026-10-02T10:00:00.000Z'),
    ...overrides,
  };
}

describe('OpalsService', () => {
  let service: OpalsService;
  let packRepo: Record<string, jest.Mock>;
  let orderRepo: Record<string, jest.Mock>;
  let manager: { query: jest.Mock; getRepository: jest.Mock };
  let liveEnrolment: { id: string } | undefined;
  let enrolments: { require: jest.Mock };
  let economy: { move: jest.Mock };
  let payments: {
    availability: jest.Mock;
    isAvailable: jest.Mock;
    start: jest.Mock;
    settlesImmediately: jest.Mock;
  };
  /** What the claim UPDATE returns: the order row, or nothing. */
  let claimRows: unknown[];

  /** The first raw query whose SQL contains `fragment`, as [sql, params]. */
  function queryCall(fragment: string): [string, unknown[]] | undefined {
    return manager.query.mock.calls.find(([sql]) =>
      String(sql).includes(fragment),
    ) as [string, unknown[]] | undefined;
  }

  beforeEach(async () => {
    claimRows = [{ id: 'o1', userId: 'u1', enrolmentId: 'e1', opals: 100 }];
    liveEnrolment = { id: 'e1' };

    packRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(pack()),
      save: jest.fn((p: unknown) => Promise.resolve(p)),
      create: jest.fn((p: unknown) => p),
    };
    orderRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(order({ status: 'paid' })),
      save: jest.fn((o: object) => Promise.resolve({ ...order(), ...o })),
      create: jest.fn((o: unknown) => o),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const qb: Record<string, jest.Mock> = {};
    for (const name of [
      'innerJoin',
      'select',
      'where',
      'andWhere',
      'orderBy',
    ]) {
      qb[name] = jest.fn(() => qb);
    }
    qb.getRawOne = jest.fn(() => Promise.resolve(liveEnrolment));

    manager = {
      query: jest.fn((sql: string) =>
        Promise.resolve(
          sql.includes('UPDATE "game_opal_orders"') && sql.includes("'paid'")
            ? [claimRows, claimRows.length]
            : [],
        ),
      ),
      getRepository: jest.fn(() => ({ createQueryBuilder: () => qb })),
    };
    const dataSource = {
      transaction: jest.fn((cb: (m: unknown) => unknown) => cb(manager)),
    };

    enrolments = {
      require: jest.fn().mockResolvedValue({ id: 'e1', userId: 'u1' }),
    };
    economy = {
      move: jest
        .fn()
        .mockResolvedValue([{ enrolmentId: 'e1', coinsAfter: 130 }]),
    };
    payments = {
      availability: jest.fn().mockReturnValue([
        { method: 'cod', available: true },
        { method: 'bank_transfer', available: true },
        { method: 'card_tbc', available: true },
        { method: 'card_bog', available: false },
      ]),
      isAvailable: jest.fn().mockReturnValue(true),
      start: jest
        .fn()
        .mockResolvedValue({ kind: 'simulated', reference: 'test_card_tbc_1' }),
      settlesImmediately: jest.fn(
        (outcome: { kind: string }) => outcome.kind === 'simulated',
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpalsService,
        { provide: getRepositoryToken(GameOpalPack), useValue: packRepo },
        { provide: getRepositoryToken(GameOpalOrder), useValue: orderRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: EnrolmentsService, useValue: enrolments },
        { provide: EconomyService, useValue: economy },
        { provide: PaymentsService, useValue: payments },
      ],
    }).compile();

    service = module.get(OpalsService);
  });

  describe('the price list', () => {
    it('shows only live packs, without the admin fields', async () => {
      packRepo.find.mockResolvedValueOnce([pack({ badge: 'BEST VALUE' })]);

      const packs = await service.listPacks();

      expect(packRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'live' } }),
      );
      expect(packs).toEqual([
        {
          id: 'p1',
          name: 'Handful',
          opals: 100,
          priceCents: 500,
          badge: 'BEST VALUE',
        },
      ]);
    });

    it('offers only card methods — there is nothing to deliver cash against', () => {
      expect(service.methods().map((m) => m.method)).toEqual([
        'card_tbc',
        'card_bog',
      ]);
    });
  });

  describe('checkout', () => {
    it('refuses a method that is not a card before touching anything', async () => {
      await expect(
        service.checkout(BUYER, 'p1', 'cod' as never),
      ).rejects.toThrow(BadRequestException);
      expect(enrolments.require).not.toHaveBeenCalled();
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('needs an enrolment, because the opals land on a season balance', async () => {
      enrolments.require.mockRejectedValueOnce(
        new NotFoundException('You have not joined this season.'),
      );

      await expect(service.checkout(BUYER, 'p1', 'card_tbc')).rejects.toThrow(
        NotFoundException,
      );
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('refuses a pack that is not live', async () => {
      packRepo.findOne.mockResolvedValueOnce(pack({ status: 'draft' }));

      await expect(service.checkout(BUYER, 'p1', 'card_tbc')).rejects.toThrow(
        NotFoundException,
      );
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('refuses when card payment is switched off', async () => {
      payments.isAvailable.mockReturnValueOnce(false);

      await expect(service.checkout(BUYER, 'p1', 'card_tbc')).rejects.toThrow(
        BadRequestException,
      );
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('writes a pending order with the pack snapshotted before paying', async () => {
      await service.checkout(BUYER, 'p1', 'card_tbc');

      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          enrolmentId: 'e1',
          packId: 'p1',
          packName: 'Handful',
          opals: 100,
          priceCents: 500,
          paymentMethod: 'card_tbc',
          status: 'pending',
        }),
      );
      // The order exists before the acquirer is asked.
      expect(orderRepo.save.mock.invocationCallOrder[0]).toBeLessThan(
        payments.start.mock.invocationCallOrder[0],
      );
      expect(payments.start).toHaveBeenCalledWith({
        id: 'o1',
        paymentMethod: 'card_tbc',
      });
    });

    it('credits the opals at once in test mode and says so', async () => {
      const result = await service.checkout(BUYER, 'p1', 'card_tbc');

      expect(economy.move).toHaveBeenCalledWith(
        ['e1'],
        {
          coins: 100,
          reason: 'opal_topup',
          refType: 'opal_order',
          refId: 'o1',
        },
        manager,
      );
      expect(result.next).toEqual({ kind: 'paid' });
      expect(result.coins).toBe(130);
      const claim = queryCall("'paid'");
      expect(claim?.[1]).toEqual(['o1', 'test_card_tbc_1', true]);
    });

    it('marks the order failed when the provider throws, and rethrows', async () => {
      payments.start.mockRejectedValueOnce(new Error('acquirer down'));

      await expect(service.checkout(BUYER, 'p1', 'card_tbc')).rejects.toThrow(
        'acquirer down',
      );
      expect(orderRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'o1' }),
        { status: 'failed' },
      );
      expect(economy.move).not.toHaveBeenCalled();
    });

    it('hands back the redirect and credits nothing yet for a live acquirer', async () => {
      payments.start.mockResolvedValueOnce({
        kind: 'redirect',
        url: 'https://pay.example/abc',
        reference: 'ref-abc',
      });
      orderRepo.findOne.mockResolvedValueOnce(order({ reference: 'ref-abc' }));

      const result = await service.checkout(BUYER, 'p1', 'card_tbc');

      expect(result.next).toEqual({
        kind: 'redirect',
        url: 'https://pay.example/abc',
      });
      expect(result.coins).toBeNull();
      expect(orderRepo.update).toHaveBeenCalledWith('o1', {
        reference: 'ref-abc',
      });
      expect(economy.move).not.toHaveBeenCalled();
    });

    it('refuses a provider that answers with something a card cannot be', async () => {
      payments.start.mockResolvedValueOnce({ kind: 'on_delivery' });

      await expect(service.checkout(BUYER, 'p1', 'card_tbc')).rejects.toThrow(
        BadRequestException,
      );
      expect(orderRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'o1' }),
        { status: 'failed' },
      );
    });
  });

  describe('settle', () => {
    it('credits once, and a replay moves nothing', async () => {
      expect(await service.settle('o1', 'ref-1')).toBe(130);
      expect(economy.move).toHaveBeenCalledTimes(1);

      claimRows = [];
      expect(await service.settle('o1', 'ref-1')).toBeNull();
      expect(economy.move).toHaveBeenCalledTimes(1);
    });

    it('records the opals as bought so they can carry to next season', async () => {
      await service.settle('o1', 'ref-1');

      const paid = queryCall('"paidOpals" = "paidOpals" + $2');
      expect(paid?.[1]).toEqual(['e1', 100]);
    });

    it('credits the live season when it changed after checkout', async () => {
      liveEnrolment = { id: 'e2' };

      await service.settle('o1', 'ref-1');

      expect(economy.move).toHaveBeenCalledWith(
        ['e2'],
        expect.objectContaining({ coins: 100, reason: 'opal_topup' }),
        manager,
      );
      const repoint = queryCall('SET "enrolmentId" = $2');
      expect(repoint?.[1]).toEqual(['o1', 'e2']);
    });

    it('falls back to the checkout enrolment between seasons', async () => {
      liveEnrolment = undefined;

      await service.settle('o1', 'ref-1');

      expect(economy.move).toHaveBeenCalledWith(
        ['e1'],
        expect.anything(),
        manager,
      );
    });
  });

  describe('admin', () => {
    it('creates packs as drafts unless told otherwise', async () => {
      const created = await service.createPack(
        { name: '  Handful  ', opals: 100, priceCents: 500, badge: '' },
        ADMIN,
      );

      expect(created).toEqual(
        expect.objectContaining({
          name: 'Handful',
          status: 'draft',
          badge: null,
          createdBy: 'admin1',
        }),
      );
    });

    it('reprices a pack without touching anything else', async () => {
      const updated = await service.updatePack('p1', { priceCents: 450 });

      expect(updated).toEqual(
        expect.objectContaining({
          priceCents: 450,
          opals: 100,
          name: 'Handful',
        }),
      );
    });

    it('refuses to blank a pack name', async () => {
      await expect(service.updatePack('p1', { name: '   ' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('says when the pack does not exist', async () => {
      packRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.updatePack('nope', { priceCents: 1 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
