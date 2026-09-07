import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import {
  ACCESS_COOKIE,
  ACCESS_TTL_MS,
  REFRESH_COOKIE,
  REFRESH_TTL_MS,
  type TokenPair,
} from './token.service';

/**
 * How a shop session is written to the browser.
 *
 * Lives outside `AuthController` because it is no longer only that
 * controller's concern: the game's front door signs somebody up and hands them
 * a session in the same request, and it has to be **the same** session — same
 * cookie names, same domain, same paths. A second implementation that drifted
 * by one attribute would produce a browser holding two `stiff_access` cookies
 * and a sign-in that appears to work until it doesn't.
 *
 * Plain functions taking `ConfigService` rather than an injectable: there is no
 * state here beyond configuration, and a controller that needs cookies should
 * not have to acquire a service to set one.
 */

/**
 * Cookie policy is env-driven so the same build works everywhere:
 * - Behind the frontend's /api proxy (recommended) or on a stiff.ge
 *   subdomain: default `lax` is correct.
 * - Backend on a completely different domain: set COOKIE_SAMESITE=none
 *   (requires HTTPS; browsers may still block third-party cookies).
 *
 * `COOKIE_DOMAIN=.stiff.ge` widens the shop session from host-only to every
 * subdomain, which is what lets a visitor who signed in on stiff.ge play on
 * game.stiff.ge without signing in again. Read the tradeoff before setting
 * it — see `cookieDomain()`.
 */
export function cookieBase(config: ConfigService) {
  const sameSite = (config.get<string>('COOKIE_SAMESITE') ?? 'lax') as
    'lax' | 'strict' | 'none';
  const secure =
    sameSite === 'none' || config.get<string>('NODE_ENV') === 'production';
  const domain = cookieDomain(config);
  return {
    httpOnly: true as const,
    sameSite,
    secure,
    ...(domain ? { domain } : {}),
  };
}

/**
 * Host-only by default; `.stiff.ge` when `COOKIE_DOMAIN` says so.
 *
 * Unset, a session created on stiff.ge is invisible to game.stiff.ge,
 * because each frontend proxies `/api/*` through its own origin and the
 * cookie is scoped to whichever host issued it. The game needs the opposite:
 * players are ordinary shop users and are expected to arrive already signed
 * in.
 *
 * What this costs: the shop session is then presented to *every* stiff.ge
 * subdomain, so compromising any one of them exposes it. Two things keep the
 * blast radius honest — admin and staff use different cookie *names* and
 * `JwtAuthGuard` prefers theirs, so neither of those sessions is affected;
 * and the refresh cookie stays scoped to `/api/auth`, so the widened cookie
 * that travels everywhere is the 15-minute access token, not the 30-day one.
 *
 * Left unset in local development on purpose: apps on localhost already
 * share cookies across ports, and a `.localhost` domain attribute is not
 * something browsers agree on.
 */
export function cookieDomain(config: ConfigService): string | undefined {
  const raw = config.get<string>('COOKIE_DOMAIN')?.trim();
  return raw ? raw : undefined;
}

export function setAuthCookies(
  res: Response,
  pair: TokenPair,
  config: ConfigService,
): void {
  dropHostOnlyCookies(res, config);
  const base = cookieBase(config);
  res.cookie(ACCESS_COOKIE, pair.accessToken, {
    ...base,
    maxAge: ACCESS_TTL_MS,
    path: '/',
  });
  res.cookie(REFRESH_COOKIE, pair.refreshToken, {
    ...base,
    maxAge: REFRESH_TTL_MS,
    path: '/api/auth',
  });
}

export function clearAuthCookies(res: Response, config: ConfigService): void {
  const base = cookieBase(config);
  res.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: '/api/auth' });
  dropHostOnlyCookies(res, config);
}

/**
 * Deletes the host-only variant of each auth cookie.
 *
 * Only does anything once `COOKIE_DOMAIN` is set, and it matters exactly
 * then. Every browser that signed in before that switch is holding a
 * host-only `stiff_access` for stiff.ge. A host-only cookie and a
 * `.stiff.ge` cookie of the same name are two distinct cookies: the browser
 * sends both, `cookie-parser` keeps one, and `clearCookie` with a domain
 * cannot remove the host-only one — so the stale token can outlive a
 * sign-out and shadow a fresh sign-in until it expires.
 *
 * Sending the deletion alongside the new cookie costs one header and makes
 * the switchover invisible instead of a week of "it logged me out again".
 * Harmless to leave in permanently: with no domain configured this clears a
 * cookie that is immediately re-set by the same response.
 */
export function dropHostOnlyCookies(
  res: Response,
  config: ConfigService,
): void {
  if (!cookieDomain(config)) return;
  const { httpOnly, sameSite, secure } = cookieBase(config);
  const hostOnly = { httpOnly, sameSite, secure };
  res.clearCookie(ACCESS_COOKIE, { ...hostOnly, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...hostOnly, path: '/api/auth' });
}
