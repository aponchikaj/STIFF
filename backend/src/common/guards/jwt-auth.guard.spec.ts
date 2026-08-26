import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_JWT_AUDIENCE,
  ADMIN_JWT_ISSUER,
  IS_ADMIN_ALLOWED_KEY,
} from '../../admin/admin.constants';
import { JwtAuthGuard, SHOP_ACCESS_COOKIE } from './jwt-auth.guard';
import type { UsersService } from '../../users/users.service';
import type { User } from '../../users/user.entity';

const SECRET = 'test-access-secret';

const adminUser = {
  id: 'admin-1',
  role: 'admin',
  isBlocked: false,
} as User;

const shopUser = {
  id: 'user-1',
  role: 'user',
  isBlocked: false,
} as User;

/** Route metadata, keyed the way the real decorators set it. */
type RouteMeta = Partial<Record<string, unknown>>;

function contextFor(
  cookies: Record<string, string>,
  method = 'GET',
): ExecutionContext {
  const request = {
    cookies,
    method,
    headers: {},
    url: '/api/orders',
    originalUrl: '/api/orders',
    ip: '203.0.113.7',
    socket: { remoteAddress: '203.0.113.7' },
  };
  return {
    getType: () => 'http',
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function buildGuard(meta: RouteMeta, env: Record<string, string> = {}) {
  const reflector = {
    getAllAndOverride: (key: string) => meta[key],
  } as unknown as Reflector;

  const jwtService = new JwtService({});
  const configService = {
    get: (key: string) => ({ JWT_ACCESS_SECRET: SECRET, ...env })[key],
  } as unknown as ConfigService;

  const usersService = {
    findById: (id: string) =>
      Promise.resolve(
        id === adminUser.id ? adminUser : id === shopUser.id ? shopUser : null,
      ),
  } as unknown as UsersService;

  return new JwtAuthGuard(reflector, jwtService, configService, usersService);
}

function adminToken(sub = adminUser.id): string {
  return new JwtService({}).sign(
    { sub, role: 'admin' },
    {
      secret: SECRET,
      audience: ADMIN_JWT_AUDIENCE,
      issuer: ADMIN_JWT_ISSUER,
      expiresIn: '5m',
    },
  );
}

function shopToken(sub = shopUser.id): string {
  return new JwtService({}).sign(
    { sub, role: 'user' },
    { secret: SECRET, expiresIn: '5m' },
  );
}

describe('JwtAuthGuard — admin session confinement', () => {
  it('lets an admin session reach an @Roles("admin") route', async () => {
    const guard = buildGuard({ [ROLES_KEY]: ['admin'] });
    const context = contextFor({ [ADMIN_ACCESS_COOKIE]: adminToken() });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('lets an admin session read a @Public() route', async () => {
    // The Products and Gallery tabs read the public listings, and the service
    // widens visibility to unpublished items when the user is an admin.
    const guard = buildGuard({ [IS_PUBLIC_KEY]: true });
    const context = contextFor({ [ADMIN_ACCESS_COOKIE]: adminToken() });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('refuses an admin session WRITING to a @Public() route', async () => {
    // CartController is @Public() at the class level, so every cart route --
    // including the ones that change it -- is public. Without the method
    // check an admin session could empty its owner's cart.
    const guard = buildGuard({ [IS_PUBLIC_KEY]: true });
    const context = contextFor({ [ADMIN_ACCESS_COOKIE]: adminToken() }, 'POST');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('still allows an admin session to write to an @Roles("admin") route', async () => {
    const guard = buildGuard({ [ROLES_KEY]: ['admin'] });
    const context = contextFor(
      { [ADMIN_ACCESS_COOKIE]: adminToken() },
      'DELETE',
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('still allows an admin session to write to an @AdminAllowed() route', async () => {
    // DELETE /comments/:id is the real case: owner-or-admin is decided in the
    // service, so it cannot carry @Roles('admin').
    const guard = buildGuard({ [IS_ADMIN_ALLOWED_KEY]: true });
    const context = contextFor(
      { [ADMIN_ACCESS_COOKIE]: adminToken() },
      'DELETE',
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('lets the session endpoints POST even though they are public', async () => {
    // AdminAuthController is @Public() + @AdminAllowed(). The browser sends
    // the admin access cookie with POST /admin/auth/refresh, so without the
    // opt-in the safe-method rule refused the very call that keeps a session
    // alive — and a session died after fifteen minutes no matter what.
    const guard = buildGuard({
      [IS_PUBLIC_KEY]: true,
      [IS_ADMIN_ALLOWED_KEY]: true,
    });
    const context = contextFor({ [ADMIN_ACCESS_COOKIE]: adminToken() }, 'POST');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('lets refresh through when the access token has already expired', async () => {
    // The ordinary case for refresh: the access token is dead, which is why
    // the call is being made. A public route must fall through to the handler
    // rather than 401, so it can read the refresh cookie.
    const guard = buildGuard(
      { [IS_PUBLIC_KEY]: true, [IS_ADMIN_ALLOWED_KEY]: true },
      { ADMIN_JWT_ACCESS_SECRET: 'a-different-secret' },
    );
    const context = contextFor({ [ADMIN_ACCESS_COOKIE]: adminToken() }, 'POST');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('lets an admin session reach an explicit @AdminAllowed() route', async () => {
    const guard = buildGuard({ [IS_ADMIN_ALLOWED_KEY]: true });
    const context = contextFor({ [ADMIN_ACCESS_COOKIE]: adminToken() });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('refuses an admin session on an ordinary logged-in route', async () => {
    // This is the point of the whole arrangement: a token lifted from
    // admin.stiff.ge must not be able to place an order as its owner.
    const guard = buildGuard({});
    const context = contextFor({ [ADMIN_ACCESS_COOKIE]: adminToken() });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuses an admin session on a route restricted to other roles', async () => {
    const guard = buildGuard({ [ROLES_KEY]: ['user'] });
    const context = contextFor({ [ADMIN_ACCESS_COOKIE]: adminToken() });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuses an admin-audience token presented as a shop session', async () => {
    // Same secret, different audience — the claim is the whole separation.
    const guard = buildGuard({});
    const context = contextFor({ [SHOP_ACCESS_COOKIE]: adminToken() });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('leaves an ordinary shop session working', async () => {
    const guard = buildGuard({});
    const context = contextFor({ [SHOP_ACCESS_COOKIE]: shopToken() });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('does not attach an admin token as the user on a public route when it is invalid', async () => {
    const guard = buildGuard(
      { [IS_PUBLIC_KEY]: true },
      {
        ADMIN_JWT_ACCESS_SECRET: 'a-different-secret',
      },
    );
    const context = contextFor({ [ADMIN_ACCESS_COOKIE]: adminToken() });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    const request = context.switchToHttp().getRequest<{ user?: User }>();
    expect(request.user).toBeUndefined();
  });

  it('blocks an admin session from outside ADMIN_IP_ALLOWLIST', async () => {
    const guard = buildGuard(
      { [ROLES_KEY]: ['admin'] },
      { ADMIN_IP_ALLOWLIST: '198.51.100.0/24' },
    );
    const context = contextFor({ [ADMIN_ACCESS_COOKIE]: adminToken() });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Insufficient permissions',
    );
  });

  it('admits an admin session from inside ADMIN_IP_ALLOWLIST', async () => {
    const guard = buildGuard(
      { [ROLES_KEY]: ['admin'] },
      { ADMIN_IP_ALLOWLIST: '203.0.113.0/24' },
    );
    const context = contextFor({ [ADMIN_ACCESS_COOKIE]: adminToken() });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects an admin token whose account is no longer an admin', async () => {
    // Demotion has to bite immediately, not when the access token lapses.
    const guard = buildGuard({ [ROLES_KEY]: ['admin'] });
    const context = contextFor({
      [ADMIN_ACCESS_COOKIE]: adminToken(shopUser.id),
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Insufficient permissions',
    );
  });
});
