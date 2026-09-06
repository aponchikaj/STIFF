import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ContentService } from '../content/content.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { VariantsService } from '../products/variants.service';
import { Order } from './order.entity';
import { OrdersService } from './orders.service';

/**
 * How an admin status change moves stock.
 *
 * The cancelled boundary is the only one that touches stock, and it moves in
 * both directions: entering cancelled puts units back, leaving it takes them
 * off again. That second direction only became reachable once `decrement`
 * started reading its own result — before that it silently did nothing, so an
 * order could be un-cancelled out of stock the shop did not have.
 */

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    userId: null,
    status: 'pending',
    items: [
      { productId: 'p1', variantId: 'v1', quantity: 2, productName: 'Tee' },
    ],
    ...overrides,
  } as Order;
}

describe('OrdersService.updateStatus', () => {
  let service: OrdersService;
  let orderRepo: { findOne: jest.Mock };
  let variantsService: {
    increment: jest.Mock;
    decrement: jest.Mock;
    syncTotal: jest.Mock;
  };

  let claim: jest.Mock;

  beforeEach(async () => {
    orderRepo = { findOne: jest.fn() };
    variantsService = {
      increment: jest.fn().mockResolvedValue(undefined),
      decrement: jest.fn().mockResolvedValue(undefined),
      syncTotal: jest.fn().mockResolvedValue(0),
    };

    // `claimStatus` runs a conditional UPDATE. `[[{ id }], 1]` is what this
    // driver returns when it matched — i.e. this caller owns the transition.
    claim = jest.fn().mockResolvedValue([[{ id: 'claimed' }], 1]);

    const dataSource = {
      transaction: jest.fn(
        async (cb: (m: unknown) => Promise<unknown>) =>
          await cb({
            save: jest.fn(),
            getRepository: jest.fn(),
            query: claim,
          }),
      ),
      getRepository: jest.fn(() => ({ findOne: jest.fn() })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: DataSource, useValue: dataSource },
        {
          provide: NotificationsService,
          useValue: { notify: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: MailService,
          useValue: { sendOrderStatus: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: PaymentsService, useValue: {} },
        { provide: VariantsService, useValue: variantsService },
        { provide: ContentService, useValue: {} },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  it('is a 404 for an order that is not there', async () => {
    orderRepo.findOne.mockResolvedValue(null);
    await expect(
      service.updateStatus('nope', { status: 'paid' }),
    ).rejects.toThrow(NotFoundException);
  });

  /** Re-sending the status the order already has must not move stock twice. */
  it('does nothing when the status is unchanged', async () => {
    orderRepo.findOne.mockResolvedValue(order({ status: 'cancelled' }));
    await service.updateStatus('id', { status: 'cancelled' });
    expect(variantsService.increment).not.toHaveBeenCalled();
    expect(variantsService.decrement).not.toHaveBeenCalled();
  });

  it('puts stock back when an order enters cancelled', async () => {
    orderRepo.findOne.mockResolvedValue(order({ status: 'paid' }));

    const result = await service.updateStatus('id', { status: 'cancelled' });

    expect(variantsService.increment).toHaveBeenCalledWith(
      expect.anything(),
      'v1',
      2,
    );
    expect(result.cancelledBy).toBe('admin');
    expect(result.cancelledAt).toBeInstanceOf(Date);
  });

  it('takes stock off again when an order leaves cancelled', async () => {
    orderRepo.findOne.mockResolvedValue(order({ status: 'cancelled' }));

    const result = await service.updateStatus('id', { status: 'paid' });

    expect(variantsService.decrement).toHaveBeenCalledWith(
      expect.anything(),
      'v1',
      2,
      // The line's snapshotted name, so "Not enough stock for X" names the
      // product the admin is looking at rather than a uuid.
      'Tee',
    );
    // Reinstating clears the cancellation record, so the order does not read
    // as both live and cancelled.
    expect(result.cancelledAt).toBeNull();
    expect(result.cancelledBy).toBeNull();
  });

  /**
   * The consequence of the `decrement` fix. Un-cancelling needs the units to
   * still be there; if they were sold in the meantime the whole transaction
   * rolls back rather than reinstating an order the shop cannot fill.
   */
  it('refuses to reinstate an order the stock no longer covers', async () => {
    orderRepo.findOne.mockResolvedValue(order({ status: 'cancelled' }));
    variantsService.decrement.mockRejectedValue(
      new BadRequestException('Not enough stock for Tee'),
    );

    await expect(
      service.updateStatus('id', { status: 'paid' }),
    ).rejects.toThrow(BadRequestException);
  });

  /**
   * The order is read before the transaction opens, so two admins pressing
   * Cancel together both see `pending`. The conditional UPDATE is what stops
   * them both restocking: only one can match the status that was read.
   */
  it('refuses the transition when someone else already moved the order', async () => {
    orderRepo.findOne.mockResolvedValue(order({ status: 'pending' }));
    claim.mockResolvedValue([[], 0]);

    await expect(
      service.updateStatus('id', { status: 'cancelled' }),
    ).rejects.toThrow(ConflictException);
  });

  it('moves no stock at all when it loses the race', async () => {
    orderRepo.findOne.mockResolvedValue(order({ status: 'pending' }));
    claim.mockResolvedValue([[], 0]);

    await expect(
      service.updateStatus('id', { status: 'cancelled' }),
    ).rejects.toThrow();
    expect(variantsService.increment).not.toHaveBeenCalled();
    expect(variantsService.decrement).not.toHaveBeenCalled();
  });

  it('claims the transition from the status it read', async () => {
    orderRepo.findOne.mockResolvedValue(order({ status: 'paid' }));

    await service.updateStatus('id', { status: 'shipped' });

    expect(claim).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "orders"'),
      ['id', 'paid', 'shipped'],
    );
  });

  /** Stamped once, so a correction cannot move the arrival date. */
  it('sets deliveredAt the first time only', async () => {
    const delivered = new Date('2026-01-01T00:00:00Z');
    orderRepo.findOne.mockResolvedValue(
      order({ status: 'shipped', deliveredAt: delivered }),
    );

    const result = await service.updateStatus('id', { status: 'delivered' });
    expect(result.deliveredAt).toBe(delivered);
  });

  it('stamps deliveredAt when there is none yet', async () => {
    orderRepo.findOne.mockResolvedValue(
      order({ status: 'shipped', deliveredAt: null }),
    );

    const result = await service.updateStatus('id', { status: 'delivered' });
    expect(result.deliveredAt).toBeInstanceOf(Date);
  });

  /**
   * A line whose variant was deleted keeps its snapshot but has no row left to
   * move stock on.
   */
  it('skips a line whose variant is gone', async () => {
    orderRepo.findOne.mockResolvedValue(
      order({
        status: 'paid',
        items: [
          { productId: null, variantId: null, quantity: 1 },
        ] as Order['items'],
      }),
    );

    await service.updateStatus('id', { status: 'cancelled' });
    expect(variantsService.increment).not.toHaveBeenCalled();
  });
});
