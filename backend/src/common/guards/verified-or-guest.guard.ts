import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Checkout's gate.
 *
 * A signed-in buyer still has to have verified their email — that rule has not
 * moved. Someone who never made an account has nothing to verify, so they pass
 * through and the order is tied to the email they type at checkout instead.
 */
@Injectable()
export class VerifiedOrGuestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (user && !user.isVerified) {
      throw new ForbiddenException('EMAIL_NOT_VERIFIED');
    }
    return true;
  }
}
