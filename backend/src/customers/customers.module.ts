import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartModule } from '../cart/cart.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrderItem } from '../orders/order-item.entity';
import { ProductVariant } from '../products/product-variant.entity';
import { Product } from '../products/product.entity';
import { AddressesService } from './addresses.service';
import { CrossSellService } from './cross-sell.service';
import { CustomersController } from './customers.controller';
import { StockAlert } from './stock-alert.entity';
import { StockAlertsService } from './stock-alerts.service';
import { UserAddress } from './user-address.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserAddress,
      StockAlert,
      ProductVariant,
      Product,
      OrderItem,
    ]),
    CartModule,
    NotificationsModule,
    MailModule,
  ],
  controllers: [CustomersController],
  providers: [AddressesService, StockAlertsService, CrossSellService],
  exports: [AddressesService, StockAlertsService, CrossSellService],
})
export class CustomersModule {}
