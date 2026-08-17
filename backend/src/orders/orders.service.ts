import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CartItem } from '../cart/cart-item.entity';
import { Paginated, paginate } from '../common/types/paginated';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';
import {
  PAYMENT_METHODS,
  SHIPPING_FEES_CENTS,
  SHIPPING_METHODS,
  type ShippingMethod,
} from './checkout.constants';
import {
  BuyNowDto,
  CheckoutDto,
  ListOrdersQueryDto,
  UpdateOrderStatusDto,
} from './dto/orders.dto';
import { OrderItem } from './order-item.entity';
import { Order, OrderStatus } from './order.entity';

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
  quantity: number;
  size: string;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
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
    await this.notifyStatus(order, false);
    void this.mailService.sendOrderInvoice(user.email, order);
    void this.mailService.sendNewOrderAlert(order, {
      username: user.username,
      email: user.email,
    });
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
    if (product.sizes.length > 0) {
      if (!size || !product.sizes.includes(size)) {
        throw new BadRequestException('Size not available for this product');
      }
    }

    const order = await this.placeOrder(
      user,
      [{ product, quantity: dto.quantity, size }],
      dto,
      false,
    );
    await this.notifyStatus(order, false);
    void this.mailService.sendOrderInvoice(user.email, order);
    void this.mailService.sendNewOrderAlert(order, {
      username: user.username,
      email: user.email,
    });
    return order;
  }

  private async placeOrder(
    user: User,
    lines: LineToOrder[],
    dto: CheckoutDto,
    clearCart: boolean,
  ): Promise<Order> {
    if (dto.paymentMethod === 'card') {
      throw new BadRequestException(
        'Card checkout is not live yet. Pay on delivery or by bank transfer.',
      );
    }
    const shippingMethod = dto.shippingMethod;
    const paymentMethod = dto.paymentMethod;
    if (!SHIPPING_METHODS.includes(shippingMethod)) {
      throw new BadRequestException('Unknown shipping method');
    }
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw new BadRequestException('Unknown payment method');
    }

    const address = this.normalizeAddress(shippingMethod, dto.shippingAddress);
    const shippingCents = SHIPPING_FEES_CENTS[shippingMethod];

    return this.dataSource.transaction(async (manager) => {
      for (const line of lines) {
        if (!line.product.isActive) {
          throw new BadRequestException(
            `${line.product.name} is no longer available`,
          );
        }
        await this.decrementStock(
          manager,
          line.product,
          line.size,
          line.quantity,
        );
      }

      const subtotalCents = lines.reduce(
        (sum, line) => sum + line.product.priceCents * line.quantity,
        0,
      );

      const order = await manager.save(
        manager.create(Order, {
          userId: user.id,
          status: 'pending',
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

      const withItems = await manager.findOne(Order, {
        where: { id: order.id },
        relations: { items: true },
      });
      return withItems ?? order;
    });
  }

  private normalizeAddress(
    method: ShippingMethod,
    addr: CheckoutDto['shippingAddress'],
  ): CheckoutDto['shippingAddress'] {
    if (method === 'pickup') {
      return {
        ...addr,
        line1: addr.line1?.trim() || 'Pickup in Tbilisi',
        city: 'Tbilisi',
        country: 'Georgia',
      };
    }
    if (!addr.line1?.trim() || !addr.city?.trim()) {
      throw new BadRequestException(
        'Address and city are required for delivery',
      );
    }
    return {
      ...addr,
      country: addr.country?.trim() || 'Georgia',
    };
  }

  private async decrementStock(
    manager: EntityManager,
    product: Product,
    size: string,
    quantity: number,
  ): Promise<void> {
    if (product.sizes.length === 0) {
      const result = await manager
        .createQueryBuilder()
        .update(Product)
        .set({ stock: () => `stock - ${quantity}` })
        .where('id = :id AND stock >= :quantity', {
          id: product.id,
          quantity,
        })
        .execute();
      if (!result.affected) {
        throw new BadRequestException(`Not enough stock for ${product.name}`);
      }
      return;
    }
    if (!size || !product.sizes.includes(size)) {
      throw new BadRequestException(`Pick a size for ${product.name}`);
    }
    const rows: unknown = await manager.query(
      `UPDATE "products"
       SET "stockBySize" = jsonb_set(
             COALESCE("stockBySize", '{}'::jsonb),
             ARRAY[$1],
             to_jsonb(COALESCE(("stockBySize"->>$1)::int, 0) - $2)
           ),
           "stock" = "stock" - $2
       WHERE "id" = $3
         AND COALESCE(("stockBySize"->>$1)::int, 0) >= $2
       RETURNING "id"`,
      [size, quantity, product.id],
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException(
        `Not enough stock for ${product.name} (${size})`,
      );
    }
  }

  private async incrementStock(
    manager: EntityManager,
    productId: string,
    size: string,
    quantity: number,
  ): Promise<void> {
    if (!size) {
      await manager.increment(Product, { id: productId }, 'stock', quantity);
      return;
    }
    await manager.query(
      `UPDATE "products"
       SET "stockBySize" = jsonb_set(
             COALESCE("stockBySize", '{}'::jsonb),
             ARRAY[$1],
             to_jsonb(COALESCE(("stockBySize"->>$1)::int, 0) + $2)
           ),
           "stock" = "stock" + $2
       WHERE "id" = $3`,
      [size, quantity, productId],
    );
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
        if (!item.productId) continue;
        if (enteringCancelled) {
          await this.incrementStock(
            manager,
            item.productId,
            item.size,
            item.quantity,
          );
        } else if (leavingCancelled) {
          const product = await manager.findOne(Product, {
            where: { id: item.productId },
          });
          if (product) {
            await this.decrementStock(
              manager,
              product,
              item.size,
              item.quantity,
            );
          }
        }
      }
      order.status = dto.status;
      await manager.save(order);
    });

    await this.notifyStatus(order, true);
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
            await this.incrementStock(
              manager,
              item.productId,
              item.size,
              item.quantity,
            );
          }
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
