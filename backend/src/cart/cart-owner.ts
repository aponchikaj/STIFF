import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';

export const CART_COOKIE = 'stiff_cart';

/** Long enough that a cart survives a few weeks of indecision. */
export const CART_COOKIE_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * Who a cart row belongs to. Exactly one of these, never both — the database
 * agrees via `CHK_cart_items_one_owner`.
 */
export type CartOwner =
  { kind: 'user'; userId: string } | { kind: 'guest'; guestId: string };

/** The `where` clause for this owner, safe to spread into a TypeORM query. */
export function ownerWhere(
  owner: CartOwner,
): { userId: string } | { guestId: string } {
  return owner.kind === 'user'
    ? { userId: owner.userId }
    : { guestId: owner.guestId };
}

/**
 * 32 random bytes, not a UUID.
 *
 * A cart holds no secrets, but the token is the only thing standing between one
 * anonymous browser and another's basket, so it should not be guessable and
 * should not encode a timestamp the way a v1 UUID would.
 */
export function newGuestId(): string {
  return randomBytes(32).toString('hex');
}

/** Rejects anything that did not come from `newGuestId`. */
export function isGuestId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

export function readGuestId(req: Request): string | null {
  const raw = (req.cookies as Record<string, unknown> | undefined)?.[
    CART_COOKIE
  ];
  return isGuestId(raw) ? raw : null;
}

export function setGuestCookie(res: Response, guestId: string): void {
  res.cookie(CART_COOKIE, guestId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: CART_COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

export function clearGuestCookie(res: Response): void {
  res.clearCookie(CART_COOKIE, { path: '/' });
}
