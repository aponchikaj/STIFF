import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_JWT_AUDIENCE,
  ADMIN_JWT_ISSUER,
} from './admin.constants';
import { assertAdminIpAllowed } from './admin-ip.guard';
import type { AdminRequest } from './admin-request';

export interface AdminAccessPayload {
  sub: string;
  role: string;
  aud?: string | string[];
  iss?: string;
}

/**
 * Authenticates the admin.stiff.ge session on `/api/admin/auth/*`.
 *
 * The role is re-read from the database on every request rather than trusted
 * from the token, so demoting or blocking an admin takes effect at once
 * instead of whenever their 15-minute access token happens to lapse.
 */
@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    assertAdminIpAllowed(request, this.configService);

    const header = request.headers.authorization;
    const token =
      request.cookies?.[ADMIN_ACCESS_COOKIE] ??
      (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    if (!token) throw new UnauthorizedException('Not authenticated');

    let payload: AdminAccessPayload;
    try {
      payload = await this.jwtService.verifyAsync<AdminAccessPayload>(token, {
        secret:
          this.configService.get<string>('ADMIN_JWT_ACCESS_SECRET') ??
          this.configService.get<string>('JWT_ACCESS_SECRET'),
        audience: ADMIN_JWT_AUDIENCE,
        issuer: ADMIN_JWT_ISSUER,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User no longer exists');
    if (user.isBlocked) throw new ForbiddenException('Account is blocked');
    if (user.role !== 'admin') {
      throw new ForbiddenException('Insufficient permissions');
    }

    request.user = user;
    request.isAdminOrigin = true;
    return true;
  }
}
