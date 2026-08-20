import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductVariant } from '../products/product-variant.entity';
import { Product } from '../products/product.entity';
import { CartItem } from './cart-item.entity';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [TypeOrmModule.forFeature([CartItem, Product, ProductVariant])],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
