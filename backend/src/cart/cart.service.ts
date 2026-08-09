import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { CartItem } from './cart-item.entity';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';

export interface CartView {
  items: CartItem[];
  subtotalCents: number;
}

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem)
    private readonly cartRepo: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async getCart(userId: string): Promise<CartView> {
    const items = await this.cartRepo.find({
      where: { userId },
      relations: { product: true },
      order: { createdAt: 'ASC' },
    });
    const subtotalCents = items.reduce(
      (sum, item) => sum + item.product.priceCents * item.quantity,
      0,
    );
    return { items, subtotalCents };
  }

  async addItem(userId: string, dto: AddCartItemDto): Promise<CartView> {
    const product = await this.productRepo.findOne({
      where: { id: dto.productId },
    });
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }
    const size = dto.size ?? '';
    if (size && product.sizes.length > 0 && !product.sizes.includes(size)) {
      throw new BadRequestException('Size not available for this product');
    }

    const existing = await this.cartRepo.findOne({
      where: { userId, productId: dto.productId, size },
    });
    const newQuantity = (existing?.quantity ?? 0) + dto.quantity;
    if (product.stock < newQuantity) {
      throw new BadRequestException(`Only ${product.stock} left in stock`);
    }

    if (existing) {
      existing.quantity = newQuantity;
      await this.cartRepo.save(existing);
    } else {
      await this.cartRepo.save(
        this.cartRepo.create({
          userId,
          productId: dto.productId,
          quantity: dto.quantity,
          size,
        }),
      );
    }
    return this.getCart(userId);
  }

  async updateItem(
    userId: string,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartView> {
    const item = await this.cartRepo.findOne({
      where: { id: itemId, userId },
      relations: { product: true },
    });
    if (!item) throw new NotFoundException('Cart item not found');
    if (item.product.stock < dto.quantity) {
      throw new BadRequestException(`Only ${item.product.stock} left in stock`);
    }
    item.quantity = dto.quantity;
    await this.cartRepo.save(item);
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string): Promise<CartView> {
    const result = await this.cartRepo.delete({ id: itemId, userId });
    if (!result.affected) throw new NotFoundException('Cart item not found');
    return this.getCart(userId);
  }

  async clear(userId: string): Promise<void> {
    await this.cartRepo.delete({ userId });
  }
}
