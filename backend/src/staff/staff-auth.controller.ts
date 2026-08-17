import {
  Body,
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
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentStaff } from './current-staff.decorator';
import { StaffLoginDto } from './dto/staff-users.dto';
import { toSafeStaffUser, StaffUser } from './entities/staff-user.entity';
import { StaffAuthService } from './staff-auth.service';
import { StaffController } from './staff-area.decorator';
import {
  STAFF_ACCESS_COOKIE,
  STAFF_ACCESS_TTL_MS,
  STAFF_REFRESH_COOKIE,
  STAFF_REFRESH_TTL_MS,
} from './staff.constants';
import type { StaffRequest } from './staff-request';
import { StaffTokenPair, StaffTokenService } from './staff-token.service';
import { StaffUsersService } from './staff-users.service';

@StaffController('auth')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class StaffAuthController {
  constructor(
    private readonly staffAuthService: StaffAuthService,
    private readonly staffTokenService: StaffTokenService,
    private readonly staffUsersService: StaffUsersService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: StaffLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.staffAuthService.login(dto);
    const pair = await this.staffTokenService.issueTokenPair(user);
    this.setAuthCookies(res, pair);
    return {
      user: toSafeStaffUser(user),
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: StaffRequest,
    @Res({ passthrough: true }) res: Response,
    @Body() body?: { refreshToken?: string },
  ) {
    const raw = req.cookies?.[STAFF_REFRESH_COOKIE] ?? body?.refreshToken;
    if (!raw) throw new UnauthorizedException('No refresh token');

    const { userId } = await this.staffTokenService.consumeRefreshToken(raw);
    const user = await this.staffUsersService.findById(userId);
    if (!user)
      throw new UnauthorizedException('Staff account no longer exists');
    if (user.isBlocked) throw new ForbiddenException('Account is blocked');

    const pair = await this.staffTokenService.issueTokenPair(user);
    const newJti = this.staffTokenService.jtiOf(pair.refreshToken);
    await this.staffTokenService.markRotated(raw, newJti ?? '');
    this.setAuthCookies(res, pair);
    return {
      user: toSafeStaffUser(user),
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
    };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: StaffRequest,
    @Res({ passthrough: true }) res: Response,
    @Body() body?: { refreshToken?: string },
  ) {
    const raw = req.cookies?.[STAFF_REFRESH_COOKIE] ?? body?.refreshToken;
    if (raw) await this.staffTokenService.revokeByRawToken(raw);
    this.clearAuthCookies(res);
    return { success: true };
  }

  @Get('me')
  me(@CurrentStaff() user: StaffUser) {
    return toSafeStaffUser(user);
  }

  private get cookieBase() {
    const sameSite = (this.configService.get<string>('COOKIE_SAMESITE') ??
      'lax') as 'lax' | 'strict' | 'none';
    const secure =
      sameSite === 'none' ||
      this.configService.get<string>('NODE_ENV') === 'production';
    return { httpOnly: true as const, sameSite, secure };
  }

  private setAuthCookies(res: Response, pair: StaffTokenPair): void {
    res.cookie(STAFF_ACCESS_COOKIE, pair.accessToken, {
      ...this.cookieBase,
      maxAge: STAFF_ACCESS_TTL_MS,
      path: '/',
    });
    res.cookie(STAFF_REFRESH_COOKIE, pair.refreshToken, {
      ...this.cookieBase,
      maxAge: STAFF_REFRESH_TTL_MS,
      path: '/api/staff/auth',
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie(STAFF_ACCESS_COOKIE, { ...this.cookieBase, path: '/' });
    res.clearCookie(STAFF_REFRESH_COOKIE, {
      ...this.cookieBase,
      path: '/api/staff/auth',
    });
  }
}
