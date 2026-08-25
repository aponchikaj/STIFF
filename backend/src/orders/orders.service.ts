import {
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CartItem } from '../cart/cart-item.entity';
import { CartOwner, ownerWhere } from '../cart/cart-owner';
import type { PaymentStart } from '../payments/payment.types';
import { PaymentsService } from '../payments/payments.service';
import { Paginated, paginate } from '../common/types/paginated';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProductVariant } from '../products/product-variant.entity';
import { Product } from '../products/product.entity';
import { NO_COLOUR, ONE_SIZE, priceForSize } from '../products/stock';
import {
  isGeorgiaRegion,
  normalizeGeorgianPhone,
  normalizePostalCode,
} from './georgia';
import { VariantsService } from '../products/variants.service';
import { User } from '../users/user.entity';
import {
  PAYMENT_METHODS,
  parseThresholdCents,
  shippingAfterThreshold,
  SHIPPING_METHODS,
  type ShippingMethod,
} from './checkout.constants';
import {
  BuyNowDto,
  CheckoutDto,
  ListOrdersQueryDto,
  UpdateOrderStatusDto,
  UpdateTrackingDto,
} from './dto/orders.dto';
import { OrderItem } from './order-item.entity';
import { Order, OrderStatus } from './order.entity';
import { ContentService } from '../content/content.service';
import { canCancel } from './cancellation';

const STATUS_MESSAGES: Record<OrderStatus, string> = {
  pending: 'We have your order.',
  paid: 'Payment received.',
  packed: 'Your order is packed.',
  shipped: 'Your order is out for delivery.',
  delivered: 'Your order was delivered.',
  cancelled: 'Your order was cancelled.',
};

interface LineToOrder {
  product: Product;
  variant: ProductVariant;
  quantity: number;
  size: string;
  /** Decided while placing the order, then snapshotted onto the order line. */
}

/**
 * Who is placing the order. A guest has no `users` row, so they get no
 * in-app notifications and no order history — the invoice email and the order
 * id are their only record, which is why the email is mandatory for them.
 */
export type Buyer =
  | { kind: 'user'; user: User }
  | { kind: 'guest'; guestId: string; email: string };

function buyerEmail(buyer: Buyer): string {
  return buyer.kind === 'user' ? buyer.user.email : buyer.email;
}

function buyerLabel(buyer: Buyer): string {
  return buyer.kind === 'user' ? buyer.user.username : 'Guest';
}

/** An order plus what the buyer has to do next to pay for it. */
export interface PlacedOrder {
  order: Order;
  payment: PaymentStart;
}

/** Product price plus this variant's delta — e.g. XXL costing more. */
function unitPrice(line: LineToOrder): number {
  return priceForSize(
    { priceCents: line.product.priceCents, variants: [line.variant] },
    line.size,
    // Matched on the variant's own colour: looking up by size alone would miss
    // a colourway row and silently charge the base price.
    line.variant.color,
  );
}

/**
 * What the buyer sees on the line, and in a "not enough stock" message.
 *
 * Colour first, because that is what someone picked before the size.
 */
function lineLabel(line: LineToOrder): string {
  const parts = [line.variant.color, line.size].filter(Boolean);
  return parts.length > 0
    ? `${line.product.name} (${parts.join(', ')})`
    : line.product.name;
}

function buyerCartOwner(buyer: Buyer): CartOwner {
  return buyer.kind === 'user'
    ? { kind: 'user', userId: buyer.user.id }
    : { kind: 'guest', guestId: buyer.guestId };
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly paymentsService: PaymentsService,
    private readonly variantsService: VariantsService,
    private readonly contentService: ContentService,
  ) {}

  async checkout(buyer: Buyer, dto: CheckoutDto): Promise<PlacedOrder> {
    const cartItems = await this.dataSource.getRepository(CartItem).find({
      where: ownerWhere(buyerCartOwner(buyer)),
      relations: { product: true, variant: true },
    });
    if (cartItems.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    const lines: LineToOrder[] = cartItems.map((item) => {
      if (!item.variant) {
        // Only reachable if the variant was deleted between adding and
        // checking out; the cart FK cascades, so this is belt and braces.
        throw new BadRequestException(
          `${item.product.name} is no longer available in ${item.size || 'that size'}`,
        );
      }
      return {
        product: item.product,
        variant: item.variant,
        quantity: item.quantity,
        size: item.size,
      };
    });

    const placed = await this.placeOrder(buyer, lines, dto, true);
    await this.announce(buyer, placed.order);
    return placed;
  }

  async buyNow(buyer: Buyer, dto: BuyNowDto): Promise<PlacedOrder> {
    const product = await this.dataSource.getRepository(Product).findOne({
      where: { id: dto.productId },
    });
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }
    const size = dto.size ?? ONE_SIZE;
    const variant = dto.variantId
      ? await this.dataSource.getRepository(ProductVariant).findOne({
          where: { id: dto.variantId, productId: product.id },
        })
      : await this.dataSource.getRepository(ProductVariant).findOne({
          where: { productId: product.id, size, color: dto.color ?? NO_COLOUR },
        });
    if (!variant || !variant.isActive) {
      throw new BadRequestException('That option is not available');
    }

    const placed = await this.placeOrder(
      buyer,
      [{ product, variant, quantity: dto.quantity, size: variant.size }],
      dto,
      false,
    );
    await this.announce(buyer, placed.order);
    return placed;
  }

  /**
   * Tell everyone who needs to know. In-app notification only for signed-in
   * buyers — a guest has no account to receive one — but both kinds get the
   * invoice, and the shop always gets its new-order alert.
   */
  private async announce(buyer: Buyer, order: Order): Promise<void> {
    if (buyer.kind === 'user') await this.notifyStatus(order, false);
    // Fire-and-forget; MailService logs failures internally.
    void this.mailService.sendOrderInvoice(buyerEmail(buyer), order);
    void this.mailService.sendNewOrderAlert(order, {
      username: buyerLabel(buyer),
      email: buyerEmail(buyer),
    });
  }

  private async placeOrder(
    buyer: Buyer,
    lines: LineToOrder[],
    dto: CheckoutDto,
    clearCart: boolean,
  ): Promise<PlacedOrder> {
    const shippingMethod = dto.shippingMethod;
    const paymentMethod = dto.paymentMethod;
    if (!SHIPPING_METHODS.includes(shippingMethod)) {
      throw new BadRequestException('Unknown shipping method');
    }
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw new BadRequestException('Unknown payment method');
    }
    // Checked before any stock moves, so an unavailable acquirer fails fast
    // rather than after the transaction has taken units off the shelf.
    if (!this.paymentsService.isAvailable(paymentMethod)) {
      throw new BadRequestException(
        'That payment method is not available right now. Pick another one.',
      );
    }

    const address = this.normalizeAddress(shippingMethod, dto.shippingAddress);
    // Read at checkout, not cached, so raising the bar mid-drop takes effect
    // for the next order rather than the next deploy.
    const storefront = await this.contentService.get('storefront');
    const threshold = parseThresholdCents(
      storefront.value.freeShippingThresholdCents as string | undefined,
    );

    return this.dataSource.transaction(async (manager) => {
      for (const line of lines) {
        if (!line.product.isActive) {
          throw new BadRequestException(
            `${line.product.name} is no longer available`,
          );
        }
        const label = lineLabel(line);

        {
          await this.variantsService.decrement(
            manager,
            line.variant.id,
            line.quantity,
            label,
          );
          await this.variantsService.syncTotal(manager, line.product.id);
        }
      }

      const subtotalCents = lines.reduce(
        (sum, line) => sum + unitPrice(line) * line.quantity,
        0,
      );

      const shippingCents = shippingAfterThreshold(
        shippingMethod,
        subtotalCents,
        threshold,
      );

      const order = await manager.save(
        manager.create(Order, {
          userId: buyer.kind === 'user' ? buyer.user.id : null,
          guestEmail: buyer.kind === 'guest' ? buyer.email : null,
          status: 'pending',
          subtotalCents,
          totalCents: subtotalCents + shippingCents,
          currency: 'gel',
          paymentMethod,
          paymentIntentId: null,
          shippingMethod,
          shippingCents,
          shippingAddress: address,
        }),
      );

      await manager.save(
        lines.map((line) =>
          manager.create(OrderItem, {
            orderId: order.id,
            productId: line.product.id,
            variantId: line.variant.id,
            productName: line.product.name,
            // The colourway's own photo when it has one, so the receipt shows
            // what was actually bought rather than the default colour.
            productImage:
              line.variant.images[0] ?? line.product.images[0] ?? null,
            unitPriceCents: unitPrice(line),
            quantity: line.quantity,
            size: line.size,
            color: line.variant.color,
          }),
        ),
      );

      if (clearCart) {
        await manager.delete(CartItem, ownerWhere(buyerCartOwner(buyer)));
      }

      // Inside the transaction on purpose: if the provider refuses, the stock
      // decrement above rolls back with it. An order nobody can pay for is a
      // worse outcome than a failed checkout.
      const payment = await this.paymentsService.start(order);
      if (this.paymentsService.settlesImmediately(payment)) {
        order.status = 'paid';
        order.paymentIntentId =
          'reference' in payment ? payment.reference : null;
        await manager.save(order);
      } else if ('reference' in payment) {
        order.paymentIntentId = payment.reference;
        await manager.save(order);
      }

      const withItems = await manager.findOne(Order, {
        where: { id: order.id },
        relations: { items: true },
      });
      return { order: withItems ?? order, payment };
    });
  }

  private normalizeAddress(
    method: ShippingMethod,
    addr: CheckoutDto['shippingAddress'],
  ): CheckoutDto['shippingAddress'] {
    // One stored shape, whatever was typed — a courier has to be able to dial
    // this. See `orders/georgia.ts` for why five spellings all arrive here.
    const phone = normalizeGeorgianPhone(addr.phone ?? '');
    if (!phone) {
      throw new BadRequestException(
        'Enter a Georgian phone number, for example 555 12 34 56.',
      );
    }
    const postalCode = normalizePostalCode(addr.postalCode) ?? undefined;

    if (method === 'pickup') {
      return {
        ...addr,
        phone,
        postalCode,
        line1: addr.line1?.trim() || 'Pickup in Tbilisi',
        city: 'Tbilisi',
        region: 'Tbilisi',
        country: 'Georgia',
      };
    }
    if (!addr.line1?.trim() || !addr.city?.trim()) {
      throw new BadRequestException(
        'Address and city are required for delivery',
      );
    }
    const region = addr.region?.trim();
    return {
      ...addr,
      phone,
      postalCode,
      region: isGeorgiaRegion(region) ? region : undefined,
      // The shop ships inside Georgia only, so this is not a question.
      country: 'Georgia',
    };
  }

  async getOne(id: string, user: User | null): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (!user) {
      // An order that belongs to an account is not readable anonymously, even
      // by the uuid — but saying "not found" to someone holding a valid
      // receipt link is a lie that costs them the order. They already have an
      // unguessable id, so confirming it exists tells them nothing new; what
      // they need is to be told which door to use.
      if (order.userId !== null) {
        throw new UnauthorizedException(
          'This order belongs to an account. Sign in to view it.',
        );
      }
      return order;
    }
    if (order.userId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('Not your order');
    }
    return order;
  }

  async adminList(query: ListOrdersQueryDto): Promise<Paginated<Order>> {
    const qb = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoin('order.user', 'user')
      .addSelect(['user.id', 'user.username', 'user.email']);

    if (query.status) {
      qb.andWhere('order.status = :status', { status: query.status });
    }
    if (query.from) {
      qb.andWhere('order.createdAt >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere("order.createdAt < CAST(:to AS date) + INTERVAL '1 day'", {
        to: query.to,
      });
    }
    if (query.search) {
      qb.andWhere(
        '(CAST(order.id AS text) ILIKE :search OR user.username ILIKE :search OR user.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    qb.orderBy('order.createdAt', 'DESC').skip(query.skip).take(query.pageSize);

    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, query.page, query.pageSize);
  }

  /** Admins can move orders between any statuses; stock follows the
   *  cancelled boundary in both directions. */
  async updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: { items: true, user: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === dto.status) return order;

    const enteringCancelled =
      dto.status === 'cancelled' && order.status !== 'cancelled';
    const leavingCancelled =
      order.status === 'cancelled' && dto.status !== 'cancelled';

    await this.dataSource.transaction(async (manager) => {
      for (const item of order.items) {
        // A line whose variant was deleted keeps its snapshot but has no row
        // left to move stock on — skip rather than guess which size it was.
        if (!item.productId || !item.variantId) continue;
        if (enteringCancelled) {
          await this.variantsService.increment(
            manager,
            item.variantId,
            item.quantity,
          );
        } else if (leavingCancelled) {
          await this.variantsService.decrement(
            manager,
            item.variantId,
            item.quantity,
            item.productName,
          );
        }
        await this.variantsService.syncTotal(manager, item.productId);
      }
      if (dto.status === 'delivered' && !order.deliveredAt) {
        // Set once, so re-marking delivered after a correction cannot move
        // the arrival date.
        order.deliveredAt = new Date();
      }
      if (enteringCancelled) {
        order.cancelledAt = new Date();
        order.cancelledBy = 'admin';
      } else if (leavingCancelled) {
        order.cancelledAt = null;
        order.cancelledBy = null;
      }
      order.status = dto.status;
      await manager.save(order);
    });

    await this.notifyStatus(order, true);
    return order;
  }

  /**
   * Customer-initiated cancellation.
   *
   * Deliberately separate from the admin `updateStatus` path: the rules about
   * when it is allowed are the customer's, and `cancelledBy` records which of
   * the two happened — "they changed their mind" and "we could not fulfil it"
   * need different follow-up.
   */
  async cancelByCustomer(
    id: string,
    user: User | null,
    cancellable: OrderStatus[],
  ): Promise<Order> {
    const order = await this.getOne(id, user);
    const check = canCancel(order, cancellable);
    if (!check.allowed) {
      throw new BadRequestException(
        check.reason ?? 'This order cannot be cancelled.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      for (const item of order.items) {
        if (!item.productId || !item.variantId) continue;
        await this.variantsService.increment(
          manager,
          item.variantId,
          item.quantity,
        );
        await this.variantsService.syncTotal(manager, item.productId);
      }
      order.status = 'cancelled';
      order.cancelledAt = new Date();
      order.cancelledBy = 'customer';
      await manager.save(order);
    });

    await this.notifyStatus(order, true);
    return order;
  }

  /** Admin sets where the parcel is. Cleared by passing empty values. */
  async setTracking(id: string, dto: UpdateTrackingDto): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    order.trackingCarrier = dto.trackingCarrier?.trim() || null;
    order.trackingNumber = dto.trackingNumber?.trim() || null;
    order.trackingUrl = dto.trackingUrl?.trim() || null;
    return this.orderRepo.save(order);
  }

  /** Move an order to a different date/month (admin bookkeeping). */
  async setDate(id: string, date: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    order.createdAt = new Date(`${date}T12:00:00`);
    return this.orderRepo.save(order);
  }

  /** Hard delete (admin). Restores stock unless the order was already
   *  cancelled (stock was returned when it entered cancelled). */
  async remove(id: string): Promise<void> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    await this.dataSource.transaction(async (manager) => {
      if (order.status !== 'cancelled') {
        for (const item of order.items) {
          if (!item.productId || !item.variantId) continue;
          await this.variantsService.increment(
            manager,
            item.variantId,
            item.quantity,
          );
          await this.variantsService.syncTotal(manager, item.productId);
        }
      }
      await manager.delete(Order, { id });
    });
  }

  private async notifyStatus(
    order: Order,
    emailCustomer: boolean,
  ): Promise<void> {
    if (!order.userId) return;
    await this.notificationsService.notify(
      order.userId,
      'order_status',
      `Order ${order.status}`,
      STATUS_MESSAGES[order.status],
      { orderId: order.id },
    );
    const email =
      order.user?.email ??
      (
        await this.dataSource.getRepository(User).findOne({
          where: { id: order.userId },
        })
      )?.email;
    if (emailCustomer && email) {
      void this.mailService.sendOrderStatus(email, order);
    }
  }
}
