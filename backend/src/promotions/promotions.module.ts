import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartModule } from '../cart/cart.module';
import { ContentModule } from '../content/content.module';
import { DiscountCode } from './discount-code.entity';
import { DiscountRedemption } from './discount-redemption.entity';
import { GiftCardLedgerEntry } from './gift-card-ledger.entity';
import { GiftCard } from './gift-card.entity';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DiscountCode,
      DiscountRedemption,
      GiftCard,
      GiftCardLedgerEntry,
    ]),
    CartModule,
    ContentModule,
  ],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
