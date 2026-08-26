import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtGuard } from './admin-jwt.guard';
import { AdminTokenService } from './admin-token.service';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { AdminRefreshToken } from './entities/admin-refresh-token.entity';

/**
 * admin.stiff.ge's half of the backend.
 *
 * Deliberately small: the panel's actual work still runs through the shop's
 * controllers under `@Roles('admin')`, so there is one implementation of
 * "update an order" rather than two that drift. What lives here is only what
 * the separate origin needs — its own session, its own network fence, and the
 * trail of what it did.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AdminRefreshToken, AdminAuditLog]),
    UsersModule,
  ],
  controllers: [AdminAuthController, AdminAuditController],
  providers: [
    AdminAuthService,
    AdminTokenService,
    AdminAuditService,
    AdminJwtGuard,
    { provide: APP_INTERCEPTOR, useClass: AdminAuditInterceptor },
  ],
  exports: [AdminTokenService, AdminAuditService],
})
export class AdminModule {}
