import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from '../comments/comment.entity';
import { OrderItem } from '../orders/order-item.entity';
import { Reaction } from '../reactions/reaction.entity';
import { FitService } from './fit.service';
import { ProductFitRating } from './product-fit-rating.entity';
import { ProductVariant } from './product-variant.entity';
import { Product } from './product.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { VariantsService } from './variants.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductVariant,
      ProductFitRating,
      Comment,
      Reaction,
      OrderItem,
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService, VariantsService, FitService],
  // VariantsService is the only thing allowed to move stock, so cart and
  // orders both reach for it rather than writing their own UPDATE.
  exports: [ProductsService, VariantsService, FitService],
})
export class ProductsModule {}
