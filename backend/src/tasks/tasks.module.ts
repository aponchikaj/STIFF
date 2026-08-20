import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';
import { CartItem } from '../cart/cart-item.entity';
import { CartModule } from '../cart/cart.module';
import { CustomersModule } from '../customers/customers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CartItem]),
    CartModule,
    CustomersModule,
    AuthModule,
    UsersModule,
    AnalyticsModule,
    NotificationsModule,
  ],
  providers: [TasksService],
})
export class TasksModule {}
