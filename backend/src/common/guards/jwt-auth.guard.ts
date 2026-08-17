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
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import { UsersService } from '../../users/users.service';
import {
  IS_STAFF_AREA_KEY,
  STAFF_JWT_AUDIENCE,
  STAFF_JWT_ISSUER,
} from '../../staff/staff.constants';

export interface AccessTokenPayload {
  sub: string;
  role: string;
  aud?: string | string[];
  iss?: string;
}

function isStaffToken(payload: AccessTokenPayload): boolean {
  const aud = payload.aud;
  const hasAud =
    aud === STAFF_JWT_AUDIENCE ||
    (Array.isArray(aud) && aud.includes(STAFF_JWT_AUDIENCE));
  return hasAud || payload.iss === STAFF_JWT_ISSUER;
}

function isStaffHttpPath(request: AuthenticatedRequest): boolean {
  const raw = request.originalUrl ?? request.url ?? '';
  const path = raw.split('?')[0];
  return (
    path === '/api/staff' ||
    path.startsWith('/api/staff/') ||
    path === '/staff' ||
    path.startsWith('/staff/') ||
    path.startsWith('/socket.io')
  );
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isStaffArea = this.reflector.getAllAndOverride<boolean>(
      IS_STAFF_AREA_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (isStaffArea || isStaffHttpPath(request)) return true;
    // Cookie first (same-site deployments); Authorization: Bearer as the
    // fallback for cross-domain setups where third-party cookies are blocked.
    const header = request.headers.authorization;
    const token =
      request.cookies?.['stiff_access'] ??
      (header?.startsWith('Bearer ') ? header.slice(7) : undefined);

    if (isPublic) {
      // Best-effort attach so public endpoints can personalize (e.g. myReaction).
      if (token) {
        try {
          const payload = await this.verify(token);
          if (!isStaffToken(payload)) {
            const user = await this.usersService.findById(payload.sub);
            if (user && !user.isBlocked) request.user = user;
          }
        } catch {
          // ignore — route is public
        }
      }
      return true;
    }

    if (!token) throw new UnauthorizedException('Not authenticated');

    let payload: AccessTokenPayload;
    try {
      payload = await this.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (isStaffToken(payload)) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User no longer exists');
    if (user.isBlocked) throw new ForbiddenException('Account is blocked');

    request.user = user;
    return true;
  }

  private verify(token: string): Promise<AccessTokenPayload> {
    return this.jwtService.verifyAsync<AccessTokenPayload>(token, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }
}
