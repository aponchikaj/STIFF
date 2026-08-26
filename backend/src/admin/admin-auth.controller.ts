import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { toSafeUser, User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AdminAllowed } from './admin-allowed.decorator';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuthService } from './admin-auth.service';
import { assertAdminIpAllowed } from './admin-ip.guard';
import { AdminJwtGuard } from './admin-jwt.guard';
import type { AdminRequest } from './admin-request';
import { AdminTokenService, type AdminTokenPair } from './admin-token.service';
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_ACCESS_TTL_MS,
  ADMIN_REFRESH_COOKIE,
  ADMIN_REFRESH_COOKIE_PATH,
  ADMIN_REFRESH_TTL_MS,
} from './admin.constants';
import { AdminLoginDto } from './dto/admin-login.dto';

/**
 * The admin.stiff.ge session endpoints.
 *
 * `@Public()` on the class means "the shop's `JwtAuthGuard` does not apply
 * here" — not that these are open. `AdminJwtGuard` protects the routes that
 * need a session; sign-in and refresh carry their own credentials.
 *
 * `@AdminAllowed()` is what lets these work at all once a session exists.
 * Admin tokens may only POST to routes that opt in, and the browser sends the
 * admin access cookie with every one of these calls — so without the opt-in,
 * refreshing and signing out were refused the moment there was a session to
 * refresh or sign out of, and a session died at the fifteen-minute mark no
 * matter what the client did.
 */
@Controller('admin/auth')
@Public()
@AdminAllowed()
export class AdminAuthController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly adminAuditService: AdminAuditService,
    private readonly adminTokenService: AdminTokenService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Five attempts a minute. The shop's `/auth/login` allows ten; this one is
   * the door to every order and every customer record, and no human types
   * their own password five times in a minute.
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: AdminLoginDto,
    @Req() req: AdminRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    assertAdminIpAllowed(req, this.configService);
    const ip = req.ip ?? req.socket?.remoteAddress ?? null;
    const user = await this.adminAuthService.login(dto, ip);
    const pair = await this.adminTokenService.issueTokenPair(user);
    this.setAuthCookies(res, pair);

    // Written here rather than by the interceptor: at this point we know who
    // succeeded, which the interceptor cannot — nobody is attached to a
    // sign-in request until it works. A sign-in is the one piece of session
    // bookkeeping worth keeping, since it is what an unexpected change in the
    // trail above would make you go looking for.
    await this.adminAuditService.record({
      actor: user,
      origin: 'admin',
      method: 'POST',
      path: '/api/admin/auth/login',
      statusCode: 200,
      ip,
      userAgent: req.headers['user-agent'] ?? null,
    });

    return { user: toSafeUser(user) };
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: AdminRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    assertAdminIpAllowed(req, this.configService);
    const raw = req.cookies?.[ADMIN_REFRESH_COOKIE];
    if (!raw) throw new UnauthorizedException('No refresh token');

    const { userId } = await this.adminTokenService.consumeRefreshToken(raw);
    const user = await this.usersService.findById(userId);

    // Re-checked on every rotation, not just at sign-in: someone demoted or
    // blocked while holding a 30-day refresh token must not be able to mint a
    // fresh admin session from it.
    if (!user || user.role !== 'admin' || user.isBlocked) {
      await this.adminTokenService.revokeAllForUser(userId);
      this.clearAuthCookies(res);
      throw new UnauthorizedException('Admin session is no longer valid');
    }

    const pair = await this.adminTokenService.issueTokenPair(user);
    await this.adminTokenService.markRotated(
      raw,
      this.adminTokenService.jtiOf(pair.refreshToken) ?? '',
    );
    this.setAuthCookies(res, pair);
    return { user: toSafeUser(user) };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: AdminRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = req.cookies?.[ADMIN_REFRESH_COOKIE];
    if (raw) await this.adminTokenService.revokeByRawToken(raw);
    this.clearAuthCookies(res);
    return { success: true };
  }

  @UseGuards(AdminJwtGuard)
  @Get('me')
  me(@CurrentUser() user: User) {
    return toSafeUser(user);
  }

  /** Ends every admin session for this account, on every device. */
  @UseGuards(AdminJwtGuard)
  @Post('logout-everywhere')
  @HttpCode(200)
  async logoutEverywhere(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.adminTokenService.revokeAllForUser(user.id);
    this.clearAuthCookies(res);
    return { success: true };
  }

  // ---------- cookie helpers ----------

  /**
   * Same env-driven policy as the shop's `AuthController`: `lax` works when
   * admin.stiff.ge proxies /api on its own origin, which is how it is
   * deployed. `COOKIE_SAMESITE=none` is only for a cross-domain backend.
   */
  private get cookieBase() {
    const sameSite = (this.configService.get<string>('COOKIE_SAMESITE') ??
      'lax') as 'lax' | 'strict' | 'none';
    const secure =
      sameSite === 'none' ||
      this.configService.get<string>('NODE_ENV') === 'production';
    return { httpOnly: true as const, sameSite, secure };
  }

  private setAuthCookies(res: Response, pair: AdminTokenPair): void {
    res.cookie(ADMIN_ACCESS_COOKIE, pair.accessToken, {
      ...this.cookieBase,
      maxAge: ADMIN_ACCESS_TTL_MS,
      path: '/',
    });
    res.cookie(ADMIN_REFRESH_COOKIE, pair.refreshToken, {
      ...this.cookieBase,
      maxAge: ADMIN_REFRESH_TTL_MS,
      path: ADMIN_REFRESH_COOKIE_PATH,
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie(ADMIN_ACCESS_COOKIE, { ...this.cookieBase, path: '/' });
    res.clearCookie(ADMIN_REFRESH_COOKIE, {
      ...this.cookieBase,
      path: ADMIN_REFRESH_COOKIE_PATH,
    });
  }
}
