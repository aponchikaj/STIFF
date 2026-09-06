import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ContentService } from '../content/content.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { VariantsService } from '../products/variants.service';
import { User } from '../users/user.entity';
import { Order, OrderStatus } from './order.entity';
import { OrdersService } from './orders.service';

/**
 * Who may read and cancel an order.
 *
 * `GET /orders/:id` and `POST /orders/:id/cancel` are both `@Public()` so a
 * guest can open the link in their invoice, which makes `getOne` the only
 * thing standing between one customer and another's name, address, phone
 * number and purchase history. The rules were written down in a comment and
 * nowhere else; this file is where they are actually held.
 */

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    userId: null,
    guestEmail: 'guest@example.com',
    status: 'pending',
    items: [],
    ...overrides,
  } as Order;
}

function shopper(overrides: Partial<User> = {}): User {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    role: 'user',
    ...overrides,
  } as User;
}

describe('OrdersService — who may see an order', () => {
  let service: OrdersService;
  let orderRepo: { findOne: jest.Mock; save: jest.Mock };
  let variantsService: { increment: jest.Mock; syncTotal: jest.Mock };
  let notificationsService: { notify: jest.Mock };
  let mailService: { sendOrderStatus: jest.Mock };

  beforeEach(async () => {
    orderRepo = { findOne: jest.fn(), save: jest.fn() };
    variantsService = {
      increment: jest.fn().mockResolvedValue(undefined),
      syncTotal: jest.fn().mockResolvedValue(0),
    };
    notificationsService = { notify: jest.fn().mockResolvedValue(undefined) };
    mailService = { sendOrderStatus: jest.fn().mockResolvedValue(undefined) };

    const dataSource = {
      // Runs the callback against a manager that records what it saved, so a
      // cancellation can be asserted without a database.
      transaction: jest.fn(
        async (cb: (m: unknown) => Promise<unknown>) =>
          await cb({ save: jest.fn(), getRepository: jest.fn() }),
      ),
      getRepository: jest.fn(() => ({ findOne: jest.fn() })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: MailService, useValue: mailService },
        { provide: PaymentsService, useValue: {} },
        { provide: VariantsService, useValue: variantsService },
        { provide: ContentService, useValue: {} },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  describe('getOne', () => {
    it('is a 404 when there is no such order', async () => {
      orderRepo.findOne.mockResolvedValue(null);
      await expect(service.getOne('missing', null)).rejects.toThrow(
        NotFoundException,
      );
    });

    /**
     * The guest receipt. The uuid is the only key they hold, exactly like the
     * order-status link every other shop sends.
     */
    it('lets an anonymous caller read a guest order', async () => {
      const guestOrder = order({ userId: null });
      orderRepo.findOne.mockResolvedValue(guestOrder);
      await expect(service.getOne(guestOrder.id, null)).resolves.toBe(
        guestOrder,
      );
    });

    /**
     * The IDOR guard. An account's order carries its history, so holding the
     * uuid is not enough — and the answer says which door to use rather than
     * lying with a 404 to someone holding a valid link.
     */
    it('refuses an account order to an anonymous caller', async () => {
      orderRepo.findOne.mockResolvedValue(order({ userId: 'someone-else' }));
      await expect(service.getOne('id', null)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.getOne('id', null)).rejects.toThrow(/Sign in/);
    });

    it("refuses another shopper's order to a signed-in shopper", async () => {
      orderRepo.findOne.mockResolvedValue(order({ userId: 'someone-else' }));
      await expect(service.getOne('id', shopper())).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lets a shopper read their own order', async () => {
      const user = shopper();
      const own = order({ userId: user.id });
      orderRepo.findOne.mockResolvedValue(own);
      await expect(service.getOne(own.id, user)).resolves.toBe(own);
    });

    /**
     * A signed-in shopper is not the guest who placed this, so the guest door
     * is closed to them too. Without this, any account could read every guest
     * order whose id it could get hold of.
     */
    it('refuses a guest order to a shopper who did not place it', async () => {
      orderRepo.findOne.mockResolvedValue(order({ userId: null }));
      await expect(service.getOne('id', shopper())).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lets an admin read anything', async () => {
      const theirs = order({ userId: 'someone-else' });
      orderRepo.findOne.mockResolvedValue(theirs);
      await expect(
        service.getOne(theirs.id, shopper({ role: 'admin' })),
      ).resolves.toBe(theirs);
    });
  });

  describe('cancelByCustomer', () => {
    /** Cancellation reads through `getOne`, so it inherits every rule above. */
    it("will not cancel someone else's order", async () => {
      orderRepo.findOne.mockResolvedValue(order({ userId: 'someone-else' }));
      await expect(
        service.cancelByCustomer('id', shopper(), ['pending']),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuses an order the shop has already acted on', async () => {
      orderRepo.findOne.mockResolvedValue(
        order({ userId: null, status: 'packed' }),
      );
      await expect(
        service.cancelByCustomer('id', null, ['pending', 'paid']),
      ).rejects.toThrow(/already being prepared/);
    });

    it('refuses an order that is already cancelled', async () => {
      orderRepo.findOne.mockResolvedValue(
        order({ userId: null, status: 'cancelled' }),
      );
      await expect(
        service.cancelByCustomer('id', null, ['pending', 'cancelled']),
      ).rejects.toThrow(/already cancelled/);
    });

    it('cancels, records who did it, and puts the stock back', async () => {
      const placed = order({
        userId: null,
        status: 'pending',
        items: [
          { productId: 'p1', variantId: 'v1', quantity: 2 },
        ] as Order['items'],
      });
      orderRepo.findOne.mockResolvedValue(placed);

      const result = await service.cancelByCustomer('id', null, ['pending']);

      expect(result.status).toBe<OrderStatus>('cancelled');
      // `cancelledBy` is what tells "they changed their mind" apart from
      // "we could not fulfil it" — the two need different follow-up.
      expect(result.cancelledBy).toBe('customer');
      expect(result.cancelledAt).toBeInstanceOf(Date);
      expect(variantsService.increment).toHaveBeenCalledWith(
        expect.anything(),
        'v1',
        2,
      );
    });

    /**
     * A line whose variant was deleted keeps its snapshot but has no row left
     * to move stock on. Guessing which size it was would corrupt a real count.
     */
    it('skips a line whose variant is gone rather than guessing', async () => {
      orderRepo.findOne.mockResolvedValue(
        order({
          userId: null,
          status: 'pending',
          items: [
            { productId: null, variantId: null, quantity: 1 },
          ] as Order['items'],
        }),
      );

      await service.cancelByCustomer('id', null, ['pending']);
      expect(variantsService.increment).not.toHaveBeenCalled();
    });

    /** A guest has no account, so there is nothing to notify. */
    it('does not try to notify a guest', async () => {
      orderRepo.findOne.mockResolvedValue(
        order({ userId: null, status: 'pending' }),
      );
      await service.cancelByCustomer('id', null, ['pending']);
      expect(notificationsService.notify).not.toHaveBeenCalled();
    });
  });
});
