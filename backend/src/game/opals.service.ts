import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { returnedRows } from '../common/utils/returned-rows';
import type { PaymentAvailability } from '../payments/payment.types';
import { PaymentsService } from '../payments/payments.service';
import { User } from '../users/user.entity';
import { EconomyService } from './economy.service';
import { GameEnrolment } from './entities/game-enrolment.entity';
import {
  GameOpalOrder,
  GameOpalPack,
  OPAL_PAYMENT_METHODS,
  type OpalOrderStatus,
  type OpalPackStatus,
  type OpalPaymentMethod,
} from './entities/game-opal.entity';
import { EnrolmentsService } from './enrolments.service';

export interface OpalPackView {
  id: string;
  name: string;
  opals: number;
  /** Tetri. 1 GEL = 100. */
  priceCents: number;
  badge: string | null;
}

export interface OpalOrderView {
  id: string;
  packName: string;
  opals: number;
  priceCents: number;
  paymentMethod: OpalPaymentMethod;
  status: OpalOrderStatus;
  testMode: boolean;
  createdAt: string;
  paidAt: string | null;
}

/** What the client does next. Never carries a credential. */
export type OpalCheckoutNext =
  /** Paid already — the opals are on the balance. */
  | { kind: 'paid' }
  /** Send the buyer to the acquirer's hosted page. */
  | { kind: 'redirect'; url: string };

export interface OpalCheckoutResult {
  order: OpalOrderView;
  next: OpalCheckoutNext;
  /** The balance after, when it is already known. */
  coins: number | null;
}

/**
 * Opals for money.
 *
 * The game's coins can be bought as well as earned. A purchase is two
 * steps with a row between them: a `pending` order is written before the
 * acquirer is contacted, and the opals are credited only by the order's
 * pending → paid transition (`settle`), which happens once however many
 * times it is asked for. In `PAYMENTS_TEST_MODE` the card providers settle
 * on the spot; a live acquirer will redirect, and its callback calls
 * `settle` with the reference it was given.
 *
 * Bought opals are the same balance as earned ones, by decision: they buy
 * from the coin shop, they count for the zero-balance sweep, and a cheating
 * verdict zeroes them with the rest. What they do that earned coins do not
 * is outlive the season — see `OpalCarryService`.
 */
@Injectable()
export class OpalsService {
  private readonly logger = new Logger(OpalsService.name);

  constructor(
    @InjectRepository(GameOpalPack)
    private readonly packRepo: Repository<GameOpalPack>,
    @InjectRepository(GameOpalOrder)
    private readonly orderRepo: Repository<GameOpalOrder>,
    private readonly dataSource: DataSource,
    private readonly enrolmentsService: EnrolmentsService,
    private readonly economy: EconomyService,
    private readonly payments: PaymentsService,
  ) {}

  // -------------------------------------------------------------- buying --

  /** What is on sale. Public: the price list is a reason to sign up. */
  async listPacks(): Promise<OpalPackView[]> {
    const packs = await this.packRepo.find({
      where: { status: 'live' },
      order: { sortOrder: 'ASC', priceCents: 'ASC' },
      take: 50,
    });
    return packs.map(packView);
  }

  /** The card methods, with whether each can take money right now. */
  methods(): PaymentAvailability[] {
    return this.payments
      .availability()
      .filter((m) =>
        (OPAL_PAYMENT_METHODS as readonly string[]).includes(m.method),
      );
  }

  async checkout(
    user: User,
    packId: string,
    method: OpalPaymentMethod,
  ): Promise<OpalCheckoutResult> {
    if (!(OPAL_PAYMENT_METHODS as readonly string[]).includes(method)) {
      throw new BadRequestException('Opals can only be bought by card.');
    }
    // Opals land on a season balance, so there has to be one. Players and
    // watchers alike — both hold coins.
    const enrolment = await this.enrolmentsService.require(user);

    const pack = await this.packRepo.findOne({ where: { id: packId } });
    if (!pack || pack.status !== 'live') {
      throw new NotFoundException('That pack is not on sale.');
    }
    if (!this.payments.isAvailable(method)) {
      throw new BadRequestException(
        'Card payment is not available right now. Try again later.',
      );
    }

    const order = await this.orderRepo.save(
      this.orderRepo.create({
        userId: user.id,
        enrolmentId: enrolment.id,
        packId: pack.id,
        packName: pack.name,
        opals: pack.opals,
        priceCents: pack.priceCents,
        paymentMethod: method,
        status: 'pending',
        reference: null,
        testMode: false,
        paidAt: null,
      }),
    );

    let outcome;
    try {
      outcome = await this.payments.start({
        id: order.id,
        paymentMethod: method,
      });
    } catch (error) {
      await this.fail(order.id);
      throw error;
    }

    if (this.payments.settlesImmediately(outcome)) {
      const reference = outcome.kind === 'simulated' ? outcome.reference : null;
      const coins = await this.settle(order.id, reference, { testMode: true });
      return {
        order: orderView(await this.reload(order.id)),
        next: { kind: 'paid' },
        coins,
      };
    }

    if (outcome.kind === 'redirect') {
      await this.orderRepo.update(order.id, { reference: outcome.reference });
      return {
        order: orderView(await this.reload(order.id)),
        next: { kind: 'redirect', url: outcome.url },
        coins: null,
      };
    }

    // A card provider answering "pay on delivery" or "here are bank
    // details" is a provider bug, not something to sell opals against.
    await this.fail(order.id);
    throw new BadRequestException('That payment method cannot be used here.');
  }

  /**
   * Marks an order paid and credits its opals — once.
   *
   * The conditional UPDATE is the whole guarantee: a replayed or concurrent
   * callback finds the order no longer `pending` and moves nothing. The
   * opals go to the account's enrolment in the *live* season when it has
   * one, so a payment that completes after the season it started in has
   * closed is not stranded; otherwise they go where checkout was, and
   * carry forward from there on the next join.
   *
   * Returns the balance after, or null when this call credited nothing.
   */
  async settle(
    orderId: string,
    reference: string | null,
    options: { testMode?: boolean } = {},
  ): Promise<number | null> {
    const balance = await this.dataSource.transaction(async (manager) => {
      const claimed = returnedRows(
        await manager.query(
          `UPDATE "game_opal_orders"
              SET "status" = 'paid',
                  "paidAt" = now(),
                  "reference" = COALESCE($2, "reference"),
                  "testMode" = $3,
                  "updatedAt" = now()
            WHERE "id" = $1 AND "status" = 'pending'
            RETURNING "id", "userId", "enrolmentId", "opals"`,
          [orderId, reference, options.testMode ?? false],
        ),
      ) as {
        id: string;
        userId: string;
        enrolmentId: string | null;
        opals: number;
      }[];
      if (claimed.length === 0) return null;
      const order = claimed[0];

      const targetId =
        (await this.liveEnrolmentId(order.userId, manager)) ??
        order.enrolmentId;
      if (!targetId) {
        // Checkout always records an enrolment, so this needs the row to
        // have been deleted under it. Paid and logged loudly beats either
        // refusing the money or crediting nobody.
        this.logger.error(
          `Opal order ${order.id} was paid but has no enrolment to credit.`,
        );
        return null;
      }

      const [moved] = await this.economy.move(
        [targetId],
        {
          coins: order.opals,
          reason: 'opal_topup',
          refType: 'opal_order',
          refId: order.id,
        },
        manager,
      );
      await manager.query(
        `UPDATE "game_enrolments"
            SET "paidOpals" = "paidOpals" + $2
          WHERE "id" = $1`,
        [targetId, order.opals],
      );
      await manager.query(
        `UPDATE "game_opal_orders" SET "enrolmentId" = $2 WHERE "id" = $1`,
        [order.id, targetId],
      );
      return moved?.coinsAfter ?? null;
    });

    if (balance !== null && options.testMode) {
      this.logger.warn(
        `Opal order ${orderId} credited by PAYMENTS_TEST_MODE — no money moved.`,
      );
    }
    return balance;
  }

  async mine(user: User): Promise<OpalOrderView[]> {
    const rows = await this.orderRepo.find({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return rows.map(orderView);
  }

  // ------------------------------------------------------------- admin --

  listAllPacks(
    options: { status?: OpalPackStatus } = {},
  ): Promise<GameOpalPack[]> {
    const where: Record<string, unknown> = {};
    if (options.status) where.status = options.status;
    return this.packRepo.find({
      where,
      order: { status: 'ASC', sortOrder: 'ASC', priceCents: 'ASC' },
      take: 200,
    });
  }

  createPack(
    input: {
      name: string;
      opals: number;
      priceCents: number;
      badge?: string | null;
      status?: OpalPackStatus;
      sortOrder?: number;
    },
    admin: User,
  ): Promise<GameOpalPack> {
    const name = input.name.trim();
    if (!name) throw new BadRequestException('A pack needs a name.');
    return this.packRepo.save(
      this.packRepo.create({
        name,
        opals: Math.round(input.opals),
        priceCents: Math.round(input.priceCents),
        badge: input.badge?.trim() || null,
        status: input.status ?? 'draft',
        sortOrder: input.sortOrder ?? 0,
        createdBy: admin.id,
      }),
    );
  }

  /**
   * Edits a pack. Safe at any time: orders snapshot the name, opals and
   * price, so a repriced pack only changes what is sold from now on.
   */
  async updatePack(
    id: string,
    input: Partial<{
      name: string;
      opals: number;
      priceCents: number;
      badge: string | null;
      status: OpalPackStatus;
      sortOrder: number;
    }>,
  ): Promise<GameOpalPack> {
    const pack = await this.packRepo.findOne({ where: { id } });
    if (!pack) throw new NotFoundException('Pack not found');
    if (input.name !== undefined) pack.name = input.name.trim();
    if (input.opals !== undefined) pack.opals = Math.round(input.opals);
    if (input.priceCents !== undefined) {
      pack.priceCents = Math.round(input.priceCents);
    }
    if (input.badge !== undefined) pack.badge = input.badge?.trim() || null;
    if (input.status !== undefined) pack.status = input.status;
    if (input.sortOrder !== undefined) pack.sortOrder = input.sortOrder;
    if (!pack.name) throw new BadRequestException('A pack needs a name.');
    return this.packRepo.save(pack);
  }

  /** Orders for the panel, newest first. */
  orders(
    options: { status?: OpalOrderStatus; limit?: number } = {},
  ): Promise<GameOpalOrder[]> {
    const where: Record<string, unknown> = {};
    if (options.status) where.status = options.status;
    return this.orderRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(options.limit ?? 200, 1), 500),
    });
  }

  // ------------------------------------------------------------ helpers --

  private async liveEnrolmentId(
    userId: string,
    manager: EntityManager,
  ): Promise<string | null> {
    const row = await manager
      .getRepository(GameEnrolment)
      .createQueryBuilder('e')
      .innerJoin('e.season', 's')
      .select('e.id', 'id')
      .where('e.userId = :userId', { userId })
      .andWhere('s.status IN (:...statuses)', {
        statuses: ['open', 'running'],
      })
      .orderBy('s.createdAt', 'DESC')
      .getRawOne<{ id: string }>();
    return row?.id ?? null;
  }

  private async fail(orderId: string): Promise<void> {
    await this.orderRepo.update(
      { id: orderId, status: In(['pending']) },
      { status: 'failed' },
    );
  }

  private async reload(orderId: string): Promise<GameOpalOrder> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}

function packView(pack: GameOpalPack): OpalPackView {
  return {
    id: pack.id,
    name: pack.name,
    opals: pack.opals,
    priceCents: pack.priceCents,
    badge: pack.badge,
  };
}

function orderView(order: GameOpalOrder): OpalOrderView {
  return {
    id: order.id,
    packName: order.packName,
    opals: order.opals,
    priceCents: order.priceCents,
    paymentMethod: order.paymentMethod,
    status: order.status,
    testMode: order.testMode,
    createdAt: new Date(order.createdAt).toISOString(),
    paidAt: order.paidAt ? new Date(order.paidAt).toISOString() : null,
  };
}
