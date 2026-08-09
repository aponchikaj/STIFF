import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CartItem } from '../cart/cart-item.entity';
import { Paginated, paginate } from '../common/types/paginated';
import { NotificationsService } from '../notifications/notifications.service';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';
import {
  BuyNowDto,
  CheckoutDto,
  ListOrdersQueryDto,
  UpdateOrderStatusDto,
} from './dto/orders.dto';
import { OrderItem } from './order-item.entity';
import { Order, OrderStatus } from './order.entity';

const STATUS_MESSAGES: Record<OrderStatus, string> = {
  pending: 'Your order is pending.',
  paid: 'Your order has been placed and paid.',
  shipped: 'Your order has been shipped.',
  delivered: 'Your order was delivered.',
  cancelled: 'Your order was cancelled.',
};

interface LineToOrder {
  product: Product;
  quantity: number;
  size: string;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  async checkout(user: User, dto: CheckoutDto): Promise<Order> {
    const cartItems = await this.dataSource.getRepository(CartItem).find({
      where: { userId: user.id },
      relations: { product: true },
    });
    if (cartItems.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    const lines: LineToOrder[] = cartItems.map((item) => ({
      product: item.product,
      quantity: item.quantity,
      size: item.size,
    }));

    const order = await this.placeOrder(user, lines, dto, true);
    await this.notifyStatus(order);
    return order;
  }

  async buyNow(user: User, dto: BuyNowDto): Promise<Order> {
    const product = await this.dataSource.getRepository(Product).findOne({
      where: { id: dto.productId },
    });
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }
    const size = dto.size ?? '';
    if (size && product.sizes.length > 0 && !product.sizes.includes(size)) {
      throw new BadRequestException('Size not available for this product');
    }

    const order = await this.placeOrder(
      user,
      [{ product, quantity: dto.quantity, size }],
      dto,
      false,
    );
    await this.notifyStatus(order);
    return order;
  }

  private async placeOrder(
    user: User,
    lines: LineToOrder[],
    dto: CheckoutDto,
    clearCart: boolean,
  ): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      // Atomic stock decrement — the WHERE guard prevents overselling under
      // concurrent checkouts.
      for (const line of lines) {
        if (!line.product.isActive) {
          throw new BadRequestException(
            `${line.product.name} is no longer available`,
          );
        }
        const result = await manager
          .createQueryBuilder()
          .update(Product)
          .set({ stock: () => `stock - ${line.quantity}` })
          .where('id = :id AND stock >= :quantity', {
            id: line.product.id,
            quantity: line.quantity,
          })
          .execute();
        if (!result.affected) {
          throw new BadRequestException(
            `Not enough stock for ${line.product.name}`,
          );
        }
      }

      const totalCents = lines.reduce(
        (sum, line) => sum + line.product.priceCents * line.quantity,
        0,
      );

      const order = await manager.save(
        manager.create(Order, {
          userId: user.id,
          status: 'pending',
          totalCents,
          currency: 'usd',
          paymentIntentId: null,
          shippingAddress: dto.shippingAddress ?? null,
        }),
      );

      await manager.save(
        lines.map((line) =>
          manager.create(OrderItem, {
            orderId: order.id,
            productId: line.product.id,
            productName: line.product.name,
            productImage: line.product.images[0] ?? null,
            unitPriceCents: line.product.priceCents,
            quantity: line.quantity,
            size: line.size,
          }),
        ),
      );

      if (clearCart) {
        await manager.delete(CartItem, { userId: user.id });
      }

      // Mock payment: immediately mark paid. Swap for a Stripe
      // PaymentIntent flow later without schema changes.
      order.status = 'paid';
      await manager.save(order);

      const withItems = await manager.findOne(Order, {
        where: { id: order.id },
        relations: { items: true },
      });
      return withItems ?? order;
    });
  }

  async getOne(id: string, user: User): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
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
      // Inclusive end of day.
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
      relations: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === dto.status) return order;

    const enteringCancelled =
      dto.status === 'cancelled' && order.status !== 'cancelled';
    const leavingCancelled =
      order.status === 'cancelled' && dto.status !== 'cancelled';

    await this.dataSource.transaction(async (manager) => {
      for (const item of order.items) {
        if (!item.productId) continue;
        if (enteringCancelled) {
          await manager.increment(
            Product,
            { id: item.productId },
            'stock',
            item.quantity,
          );
        } else if (leavingCancelled) {
          await manager.decrement(
            Product,
            { id: item.productId },
            'stock',
            item.quantity,
          );
        }
      }
      order.status = dto.status;
      await manager.save(order);
    });

    await this.notifyStatus(order);
    return order;
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
          if (item.productId) {
            await manager.increment(
              Product,
              { id: item.productId },
              'stock',
              item.quantity,
            );
          }
        }
      }
      await manager.delete(Order, { id });
    });
  }

  private async notifyStatus(order: Order): Promise<void> {
    if (!order.userId) return;
    await this.notificationsService.notify(
      order.userId,
      'order_status',
      `Order ${order.status}`,
      STATUS_MESSAGES[order.status],
      { orderId: order.id },
    );
  }
}
