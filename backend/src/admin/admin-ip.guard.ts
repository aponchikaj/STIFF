import { ForbiddenException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { isIpAllowed, normaliseIp, parseAllowlist } from './admin-ip';

const logger = new Logger('AdminIpAllowlist');

/**
 * Enforces `ADMIN_IP_ALLOWLIST` for anything reaching admin.stiff.ge.
 *
 * Called from `AdminJwtGuard` (every authenticated admin request), from the
 * sign-in handler (so a blocked network cannot even try passwords), and from
 * `JwtAuthGuard` when it accepts an admin-audience token. Unset means off —
 * see `admin-ip.ts` for why that default is the safe one.
 */
export function assertAdminIpAllowed(
  request: Request,
  configService: ConfigService,
): void {
  const rules = parseAllowlist(configService.get<string>('ADMIN_IP_ALLOWLIST'));
  if (rules.length === 0) return;

  const ip = request.ip ?? request.socket?.remoteAddress;
  if (isIpAllowed(ip, rules)) return;

  logger.warn(
    `Blocked admin request from ${normaliseIp(ip) ?? 'unknown address'} — not on ADMIN_IP_ALLOWLIST`,
  );
  // Deliberately not "your IP is blocked": a prober learns nothing from this
  // that they could not learn from any other 403 on the site.
  throw new ForbiddenException('Insufficient permissions');
}
