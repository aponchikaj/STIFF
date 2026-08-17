import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { StaffPermission } from './staff.constants';
import { hasPermission } from './permissions';
import { STAFF_PERMISSIONS_KEY } from './staff-permissions.decorator';
import type { StaffRequest } from './staff-request';

@Injectable()
export class StaffPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<StaffPermission[]>(
      STAFF_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<StaffRequest>();
    const user = request.staffUser;
    if (
      !user ||
      !required.every((permission) => hasPermission(user, permission))
    ) {
      throw new ForbiddenException('Insufficient staff permissions');
    }
    return true;
  }
}
