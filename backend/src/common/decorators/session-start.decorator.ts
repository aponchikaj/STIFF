import { SetMetadata } from '@nestjs/common';

/**
 * A route that starts, renews or ends a shop session from what is in the
 * request body — sign-in, sign-up, refresh, sign-out, the password and
 * verification links.
 *
 * On these, `JwtAuthGuard` ignores an admin access cookie the browser
 * happens to be carrying. Such a cookie is ambient: it rides along because
 * the browser shares one cookie jar per host (every `localhost` port is one
 * host), not because the caller meant to use it. Without this, signing in to
 * the game in a browser that is also signed in to the admin panel failed
 * with "This endpoint is not available to an admin session".
 *
 * It grants an admin token nothing: the admin cookie is dropped, never
 * attached as the user. An admin token sent *explicitly* as the bearer is
 * still judged by the admin rules.
 */
export const IS_SESSION_START_KEY = 'isSessionStart';
export const SessionStart = () => SetMetadata(IS_SESSION_START_KEY, true);
