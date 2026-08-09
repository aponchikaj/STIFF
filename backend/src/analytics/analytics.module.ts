import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from '../comments/comment.entity';
import { ContactMessage } from '../contact/contact-message.entity';
import { OrderItem } from '../orders/order-item.entity';
import { Order } from '../orders/order.entity';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsSnapshot } from './analytics-snapshot.entity';
import { PageView } from './page-view.entity';
import { TrackController } from './track.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AnalyticsSnapshot,
      PageView,
      Order,
      OrderItem,
      User,
      Product,
      Comment,
      ContactMessage,
    ]),
  ],
  controllers: [AnalyticsController, TrackController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
