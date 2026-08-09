import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';
import { CartItem } from '../cart/cart-item.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CartItem]),
    AuthModule,
    UsersModule,
    AnalyticsModule,
    NotificationsModule,
  ],
  providers: [TasksService],
})
export class TasksModule {}
