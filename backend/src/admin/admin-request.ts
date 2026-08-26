import type { AuthenticatedRequest } from '../common/types/authenticated-request';

/**
 * `isAdminOrigin` is set by whichever guard authenticated the request and is
 * read by the audit interceptor, so a trail entry records whether the change
 * came from admin.stiff.ge or from a shop session.
 */
export interface AdminRequest extends AuthenticatedRequest {
  isAdminOrigin?: boolean;
}
