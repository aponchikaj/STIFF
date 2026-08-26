import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';
import { AdminAuditService } from './admin-audit.service';
import type { AdminRequest } from './admin-request';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Writes the admin trail.
 *
 * Scoped to state changes made by someone whose role is admin, from either
 * origin — an order edited from a leftover shop session is exactly as
 * interesting as one edited from admin.stiff.ge, so both are recorded and the
 * entry says which.
 *
 * Only successes are written. A rejected request changed nothing, and letting
 * failed attempts into the same table would bury the handful of entries that
 * describe real changes under every typo and expired token.
 */
@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AdminAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<AdminRequest>();

    if (!MUTATING.has(request.method?.toUpperCase() ?? '')) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        // Read after the handler so a role change inside the request cannot
        // rewrite who is recorded as having made it.
        const actor = request.user;
        if (!actor || actor.role !== 'admin') return;

        const response = http.getResponse<Response>();
        void this.auditService.record({
          actor,
          origin: request.isAdminOrigin ? 'admin' : 'shop',
          method: request.method,
          path: (request.originalUrl ?? request.url ?? '').split('?')[0],
          statusCode: response.statusCode,
          ip: request.ip ?? request.socket?.remoteAddress ?? null,
          userAgent: request.headers['user-agent'] ?? null,
          body: request.body,
        });
      }),
    );
  }
}
