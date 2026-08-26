/**
 * admin.stiff.ge runs on its own origin with its own session.
 *
 * The audience/issuer claims are what keep the three sessions this backend
 * serves from being interchangeable: a shop token (no audience) cannot act on
 * admin.stiff.ge, an admin token cannot post a comment as its owner, and
 * neither is a staff token. See `JwtAuthGuard` for the enforcement.
 */
export const ADMIN_JWT_AUDIENCE = 'stiff-admin';
export const ADMIN_JWT_ISSUER = 'stiff-admin';

/** Distinct names so a browser holding both sessions never confuses them. */
export const ADMIN_ACCESS_COOKIE = 'stiff_admin_access';
export const ADMIN_REFRESH_COOKIE = 'stiff_admin_refresh';

export const ADMIN_ACCESS_TTL_MS = 15 * 60 * 1000;
export const ADMIN_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Refresh cookie is scoped to the only path that reads it. */
export const ADMIN_REFRESH_COOKIE_PATH = '/api/admin/auth';

/**
 * Marks a handler an admin-audience token may call even though it is not
 * `@Roles('admin')` — the deliberate, reviewable exceptions to "admin sessions
 * may only touch admin-guarded routes".
 */
export const IS_ADMIN_ALLOWED_KEY = 'isAdminAllowed';
