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
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import type { UserRole } from '../../users/user.entity';
import { UsersService } from '../../users/users.service';
import {
  IS_STAFF_AREA_KEY,
  STAFF_JWT_AUDIENCE,
  STAFF_JWT_ISSUER,
} from '../../staff/staff.constants';
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_JWT_AUDIENCE,
  ADMIN_JWT_ISSUER,
  IS_ADMIN_ALLOWED_KEY,
} from '../../admin/admin.constants';
import { assertAdminIpAllowed } from '../../admin/admin-ip.guard';
import type { AdminRequest } from '../../admin/admin-request';

export const SHOP_ACCESS_COOKIE = 'stiff_access';

export interface AccessTokenPayload {
  sub: string;
  role: string;
  aud?: string | string[];
  iss?: string;
}

function hasAudience(
  payload: AccessTokenPayload | null,
  audience: string,
  issuer: string,
): boolean {
  if (!payload) return false;
  const aud = payload.aud;
  const matchesAud =
    aud === audience || (Array.isArray(aud) && aud.includes(audience));
  return matchesAud || payload.iss === issuer;
}

function isStaffToken(payload: AccessTokenPayload | null): boolean {
  return hasAudience(payload, STAFF_JWT_AUDIENCE, STAFF_JWT_ISSUER);
}

function isAdminToken(payload: AccessTokenPayload | null): boolean {
  return hasAudience(payload, ADMIN_JWT_AUDIENCE, ADMIN_JWT_ISSUER);
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

    const request = context.switchToHttp().getRequest<AdminRequest>();
    if (isStaffArea || isStaffHttpPath(request)) return true;

    const header = request.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    // Cookie first (same-site deployments); Authorization: Bearer as the
    // fallback for cross-domain setups where third-party cookies are blocked.
    // The two origins use different cookie names, so a browser holding both
    // sessions presents each only to the site it belongs to.
    const bearerIsAdmin = isAdminToken(this.peek(bearer));
    const adminToken =
      request.cookies?.[ADMIN_ACCESS_COOKIE] ??
      (bearerIsAdmin ? bearer : undefined);
    const shopToken =
      request.cookies?.[SHOP_ACCESS_COOKIE] ??
      (bearerIsAdmin ? undefined : bearer);

    if (adminToken) {
      const outcome = await this.tryAdminToken(context, request, adminToken);
      if (outcome === 'ok') return true;
      if (outcome === 'invalid') return isPublic === true;
      // An admin session reaching a route it may not use is a hard stop, even
      // on a public one: silently downgrading it to an anonymous request would
      // hide the mistake instead of surfacing it.
      throw new UnauthorizedException(
        'This endpoint is not available to an admin session',
      );
    }

    if (isPublic) {
      // Best-effort attach so public endpoints can personalize (e.g. myReaction).
      if (shopToken) {
        try {
          const payload = await this.verifyShop(shopToken);
          if (!isStaffToken(payload) && !isAdminToken(payload)) {
            const user = await this.usersService.findById(payload.sub);
            if (user && !user.isBlocked) request.user = user;
          }
        } catch {
          // ignore — route is public
        }
      }
      return true;
    }

    if (!shopToken) throw new UnauthorizedException('Not authenticated');

    let payload: AccessTokenPayload;
    try {
      payload = await this.verifyShop(shopToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // A staff or admin token must never pass as a shop session, even when the
    // secrets happen to match — the audience claim is the whole separation.
    if (isStaffToken(payload) || isAdminToken(payload)) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User no longer exists');
    if (user.isBlocked) throw new ForbiddenException('Account is blocked');

    request.user = user;
    return true;
  }

  /**
   * Admits an admin.stiff.ge session — but only to the routes it has business
   * touching.
   *
   * The panel's work lives on the shop's own controllers, so the admin origin
   * has to reach them. What it must not reach is everything *else* the shop
   * exposes: without this check, an admin token lifted from admin.stiff.ge
   * could place orders, post comments and empty a cart as its owner. So the
   * route has to opt in — by being `@Roles('admin')`, by being `@Public()`, or
   * by carrying the explicit `@AdminAllowed()` exception.
   */
  private async tryAdminToken(
    context: ExecutionContext,
    request: AdminRequest,
    token: string,
  ): Promise<'ok' | 'not-permitted' | 'invalid'> {
    const targets = [context.getHandler(), context.getClass()];
    const requiredRoles =
      this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, targets) ?? [];
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      targets,
    );
    const isAdminAllowed = this.reflector.getAllAndOverride<boolean>(
      IS_ADMIN_ALLOWED_KEY,
      targets,
    );

    const permitted =
      requiredRoles.includes('admin') ||
      isPublic === true ||
      isAdminAllowed === true;
    if (!permitted) return 'not-permitted';

    assertAdminIpAllowed(request, this.configService);

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret:
          this.configService.get<string>('ADMIN_JWT_ACCESS_SECRET') ??
          this.configService.get<string>('JWT_ACCESS_SECRET'),
        audience: ADMIN_JWT_AUDIENCE,
        issuer: ADMIN_JWT_ISSUER,
      });
    } catch {
      if (isPublic) return 'invalid';
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Role comes from the database, never from the token, so a demotion ends
    // the session's powers at once rather than 15 minutes later.
    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User no longer exists');
    if (user.isBlocked) throw new ForbiddenException('Account is blocked');
    if (user.role !== 'admin') {
      throw new ForbiddenException('Insufficient permissions');
    }

    request.user = user;
    request.isAdminOrigin = true;
    return 'ok';
  }

  /** Unverified read of the claims — used only to decide which secret to try. */
  private peek(token: string | undefined): AccessTokenPayload | null {
    if (!token) return null;
    try {
      return this.jwtService.decode<AccessTokenPayload>(token) ?? null;
    } catch {
      return null;
    }
  }

  private verifyShop(token: string): Promise<AccessTokenPayload> {
    return this.jwtService.verifyAsync<AccessTokenPayload>(token, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }
}
