import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentModule } from '../content/content.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Order } from '../orders/order.entity';
import { OrdersModule } from '../orders/orders.module';
import { ReturnRequestItem } from './return-request-item.entity';
import { ReturnRequest } from './return-request.entity';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReturnRequest, ReturnRequestItem, Order]),
    OrdersModule,
    ContentModule,
    NotificationsModule,
    MailModule,
  ],
  controllers: [ReturnsController],
  providers: [ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
