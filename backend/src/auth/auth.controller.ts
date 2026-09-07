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
import { clearAuthCookies, setAuthCookies } from './auth-cookies';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  DeleteAccountDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/password.dto';
import { REFRESH_COOKIE, TokenPair, TokenService } from './token.service';

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

  /**
   * Both delegate to `auth-cookies.ts`, which the game's front door also uses.
   * The game signs somebody up and hands them a session in one request, and it
   * has to be the *same* session — a second implementation that drifted by one
   * attribute would leave a browser holding two `stiff_access` cookies.
   */
  private setAuthCookies(res: Response, pair: TokenPair): void {
    setAuthCookies(res, pair, this.configService);
  }

  private clearAuthCookies(res: Response): void {
    clearAuthCookies(res, this.configService);
  }
}
