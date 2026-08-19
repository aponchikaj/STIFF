import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { CollabModule } from './collab/collab.module';
import { CommentsModule } from './comments/comments.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ContactModule } from './contact/contact.module';
import { ContentModule } from './content/content.module';
import { GalleryModule } from './gallery/gallery.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ProductsModule } from './products/products.module';
import { ReactionsModule } from './reactions/reactions.module';
import { SearchModule } from './search/search.module';
import { StaffModule } from './staff/staff.module';
import { TasksModule } from './tasks/tasks.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    JwtModule.register({ global: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST') ?? 'localhost',
        port: parseInt(config.get<string>('DB_PORT') ?? '5432', 10),
        username: config.get<string>('DB_USERNAME') ?? 'stiff',
        password: config.get<string>('DB_PASSWORD') ?? 'stiff',
        database: config.get<string>('DB_NAME') ?? 'stiff',
        ssl:
          config.get<string>('DB_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,
        // Migration SQL is unqualified, so new objects land in the first entry.
        // The rest only exist so extension functions resolve — Supabase installs
        // those outside public.
        extra: { options: '-c search_path=public,extensions' },
        autoLoadEntities: true,
        // Never let TypeORM reshape a live schema on boot. Schema changes go
        // through `npm run migration:generate` and are reviewed as code.
        synchronize: false,
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: config.get<string>('DB_MIGRATIONS_RUN') !== 'false',
      }),
    }),
    MailModule,
    UsersModule,
    AuthModule,
    ProductsModule,
    GalleryModule,
    ReactionsModule,
    CommentsModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    NotificationsModule,
    ContactModule,
    ContentModule,
    CollabModule,
    AnalyticsModule,
    UploadsModule,
    SearchModule,
    TasksModule,
    StaffModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guard order matters: throttle first, then authenticate, then authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
