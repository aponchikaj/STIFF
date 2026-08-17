import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import {
  STAFF_ACCESS_COOKIE,
  STAFF_JWT_AUDIENCE,
  STAFF_JWT_ISSUER,
} from './staff.constants';
import type { StaffRequest } from './staff-request';
import { StaffUsersService } from './staff-users.service';

export interface StaffAccessPayload {
  sub: string;
  role: string;
  aud?: string;
}

@Injectable()
export class StaffJwtGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly staffUsersService: StaffUsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<StaffRequest>();
    const header = request.headers.authorization;
    const token =
      request.cookies?.[STAFF_ACCESS_COOKIE] ??
      (header?.startsWith('Bearer ') ? header.slice(7) : undefined);

    if (isPublic) {
      if (token) {
        try {
          const payload = await this.verify(token);
          const user = await this.staffUsersService.findById(payload.sub);
          if (user && !user.isBlocked) request.staffUser = user;
        } catch {
          // public route
        }
      }
      return true;
    }

    if (!token) throw new UnauthorizedException('Not authenticated');

    let payload: StaffAccessPayload;
    try {
      payload = await this.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.staffUsersService.findById(payload.sub);
    if (!user)
      throw new UnauthorizedException('Staff account no longer exists');
    if (user.isBlocked) throw new ForbiddenException('Account is blocked');

    request.staffUser = user;
    return true;
  }

  private verify(token: string): Promise<StaffAccessPayload> {
    return this.jwtService.verifyAsync<StaffAccessPayload>(token, {
      secret:
        this.configService.get<string>('STAFF_JWT_ACCESS_SECRET') ??
        this.configService.get<string>('JWT_ACCESS_SECRET'),
      audience: STAFF_JWT_AUDIENCE,
      issuer: STAFF_JWT_ISSUER,
    });
  }
}
