import { SetMetadata } from '@nestjs/common';
import { IS_ADMIN_ALLOWED_KEY } from './admin.constants';

/**
 * Opens a handler to admin.stiff.ge sessions.
 *
 * Only needed where a route is genuinely admin work but cannot carry
 * `@Roles('admin')` because it also serves ordinary users — `DELETE
 * /comments/:id` is the case that forced this: the service decides
 * owner-or-admin internally, so the decorator cannot.
 *
 * Every use widens what a stolen admin token can reach. Add one only with a
 * reason, and prefer `@Roles('admin')` whenever the route is admin-only.
 */
export const AdminAllowed = () => SetMetadata(IS_ADMIN_ALLOWED_KEY, true);
