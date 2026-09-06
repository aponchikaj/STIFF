import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { clearGuestCookie, readGuestId } from '../cart/cart-owner';
import { CartService } from '../cart/cart.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { Public } from '../common/decorators/public.decorator';
import { toSafeUser, User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  DeleteAccountDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/password.dto';
import {
  ACCESS_COOKIE,
  ACCESS_TTL_MS,
  REFRESH_COOKIE,
  REFRESH_TTL_MS,
  TokenPair,
  TokenService,
} from './token.service';

@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly cartService: CartService,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.register(dto);
    await this.adoptGuestCart(req, res, user.id);
    const pair = await this.tokenService.issueTokenPair(user);
    this.setAuthCookies(res, pair);
    return {
      user: toSafeUser(user),
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.login(dto);
    await this.adoptGuestCart(req, res, user.id);
    const pair = await this.tokenService.issueTokenPair(user);
    this.setAuthCookies(res, pair);
    return {
      user: toSafeUser(user),
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
    @Body() body?: { refreshToken?: string },
  ) {
    const raw = req.cookies?.[REFRESH_COOKIE] ?? body?.refreshToken;
    if (!raw) throw new UnauthorizedException('No refresh token');

    const { userId } = await this.tokenService.consumeRefreshToken(raw);
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User no longer exists');
    if (user.isBlocked) {
      throw new ForbiddenException('Account is blocked');
    }

    const pair = await this.tokenService.issueTokenPair(user);
    const newJti = this.tokenService.jtiOf(pair.refreshToken);
    await this.tokenService.markRotated(raw, newJti ?? '');
    this.setAuthCookies(res, pair);
    return {
      user: toSafeUser(user),
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
    };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
    @Body() body?: { refreshToken?: string },
  ) {
    const raw = req.cookies?.[REFRESH_COOKIE] ?? body?.refreshToken;
    if (raw) await this.tokenService.revokeByRawToken(raw);
    this.clearAuthCookies(res);
    return { success: true };
  }

  @Get('me')
  me(@CurrentUser() user: User) {
    return toSafeUser(user);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto.token);
    return { success: true };
  }

  @Post('resend-verification')
  @HttpCode(200)
  async resendVerification(@CurrentUser() user: User) {
    await this.authService.sendVerification(user);
    return { success: true };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { success: true };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { success: true };
  }

  @Delete('account')
  async deleteAccount(
    @CurrentUser() user: User,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.usersService.deleteOwnAccount(user, dto.password);
    this.clearAuthCookies(res);
    return { success: true };
  }

  // ---------- cookie helpers ----------

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
  private get cookieBase() {
    const sameSite = (this.configService.get<string>('COOKIE_SAMESITE') ??
      'lax') as 'lax' | 'strict' | 'none';
    const secure =
      sameSite === 'none' ||
      this.configService.get<string>('NODE_ENV') === 'production';
    const domain = this.cookieDomain();
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
  private cookieDomain(): string | undefined {
    const raw = this.configService.get<string>('COOKIE_DOMAIN')?.trim();
    return raw ? raw : undefined;
  }

  /**
   * Folds anything added before signing in into the account's cart, then drops
   * the guest cookie so the two can never diverge again.
   *
   * Deliberately non-fatal: a cart that fails to merge is a worse outcome than
   * a login that fails, so the error is swallowed and the visitor keeps their
   * session.
   */
  private async adoptGuestCart(
    req: Request,
    res: Response,
    userId: string,
  ): Promise<void> {
    const guestId = readGuestId(req);
    if (!guestId) return;
    try {
      await this.cartService.mergeGuestCart(guestId, userId);
    } catch {
      // Keep the sign-in; the guest cart stays put for a later attempt.
      return;
    }
    clearGuestCookie(res);
  }

  private setAuthCookies(res: Response, pair: TokenPair): void {
    this.dropHostOnlyCookies(res);
    res.cookie(ACCESS_COOKIE, pair.accessToken, {
      ...this.cookieBase,
      maxAge: ACCESS_TTL_MS,
      path: '/',
    });
    res.cookie(REFRESH_COOKIE, pair.refreshToken, {
      ...this.cookieBase,
      maxAge: REFRESH_TTL_MS,
      path: '/api/auth',
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_COOKIE, { ...this.cookieBase, path: '/' });
    res.clearCookie(REFRESH_COOKIE, {
      ...this.cookieBase,
      path: '/api/auth',
    });
    this.dropHostOnlyCookies(res);
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
  private dropHostOnlyCookies(res: Response): void {
    if (!this.cookieDomain()) return;
    const { httpOnly, sameSite, secure } = this.cookieBase;
    const hostOnly = { httpOnly, sameSite, secure };
    res.clearCookie(ACCESS_COOKIE, { ...hostOnly, path: '/' });
    res.clearCookie(REFRESH_COOKIE, { ...hostOnly, path: '/api/auth' });
  }
}
