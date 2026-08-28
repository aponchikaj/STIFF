import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { CartService } from '../cart/cart.service';
import type { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ACCESS_COOKIE, REFRESH_COOKIE, TokenService } from './token.service';

/**
 * The shop session has to be visible on game.stiff.ge, which means widening it
 * from host-only to `.stiff.ge`. These pin the two things that go wrong when
 * you do that: forgetting the domain on one of the cookies, and leaving the
 * pre-existing host-only cookie behind to shadow the new one.
 */

interface CookieCall {
  name: string;
  value?: string;
  options: Record<string, unknown>;
}

function harness(cookieDomain?: string) {
  const set: CookieCall[] = [];
  const cleared: CookieCall[] = [];

  const user = { id: 'u1', role: 'user' } as User;

  const controller = new AuthController(
    { login: () => Promise.resolve(user) } as unknown as AuthService,
    {
      issueTokenPair: () =>
        Promise.resolve({ accessToken: 'a.b.c', refreshToken: 'd.e.f' }),
    } as unknown as TokenService,
    {} as UsersService,
    {
      get: (key: string) =>
        key === 'COOKIE_DOMAIN' ? cookieDomain : undefined,
    } as unknown as ConfigService,
    {} as CartService,
  );

  const res = {
    cookie(name: string, value: string, options: Record<string, unknown>) {
      set.push({ name, value, options });
    },
    clearCookie(name: string, options: Record<string, unknown>) {
      cleared.push({ name, options });
    },
  } as unknown as Response;

  // No guest cart cookie, so `adoptGuestCart` is a no-op.
  const req = { cookies: {}, headers: {} } as unknown as Request;

  return { controller, res, req, set, cleared };
}

const login = { email: 'a@b.c', password: 'x' };

describe('auth cookie domain', () => {
  it('stays host-only when COOKIE_DOMAIN is unset', async () => {
    const h = harness(undefined);
    await h.controller.login(login, h.req, h.res);

    expect(h.set).toHaveLength(2);
    for (const call of h.set) {
      expect(call.options).not.toHaveProperty('domain');
    }
    // Nothing to migrate away from, so no deletions are emitted.
    expect(h.cleared).toHaveLength(0);
  });

  it('sets both cookies on the parent domain when configured', async () => {
    const h = harness('.stiff.ge');
    await h.controller.login(login, h.req, h.res);

    const access = h.set.find((c) => c.name === ACCESS_COOKIE);
    const refresh = h.set.find((c) => c.name === REFRESH_COOKIE);

    expect(access?.options.domain).toBe('.stiff.ge');
    expect(refresh?.options.domain).toBe('.stiff.ge');
    expect(access?.options.httpOnly).toBe(true);
  });

  it('keeps the refresh cookie scoped to /api/auth even when widened', async () => {
    // The access token travels to every subdomain; the 30-day refresh token
    // must not follow it any further than it already went.
    const h = harness('.stiff.ge');
    await h.controller.login(login, h.req, h.res);

    const refresh = h.set.find((c) => c.name === REFRESH_COOKIE);
    expect(refresh?.options.path).toBe('/api/auth');
  });

  it('deletes the host-only cookies it is replacing', async () => {
    const h = harness('.stiff.ge');
    await h.controller.login(login, h.req, h.res);

    // A host-only cookie and a `.stiff.ge` cookie of the same name are two
    // different cookies. Without these deletions, every browser that signed in
    // before the switch keeps a stale token that `clearCookie` with a domain
    // cannot reach.
    expect(h.cleared).toHaveLength(2);
    for (const call of h.cleared) {
      expect(call.options).not.toHaveProperty('domain');
    }
    expect(h.cleared.map((c) => c.name).sort()).toEqual(
      [ACCESS_COOKIE, REFRESH_COOKIE].sort(),
    );
  });

  it('deletes the host-only cookies before setting the new ones', async () => {
    // Order is load-bearing: the browser applies Set-Cookie headers in the
    // order they arrive, so a deletion emitted afterwards would remove the
    // cookie that was just issued.
    const h = harness('.stiff.ge');
    const order: string[] = [];
    const res = {
      cookie: (name: string) => order.push(`set:${name}`),
      clearCookie: (name: string) => order.push(`clear:${name}`),
    } as unknown as Response;

    await h.controller.login(login, h.req, res);

    expect(order.indexOf(`clear:${ACCESS_COOKIE}`)).toBeLessThan(
      order.indexOf(`set:${ACCESS_COOKIE}`),
    );
  });
});
