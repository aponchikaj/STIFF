import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import type { StringValue } from 'ms';
import { IsNull, LessThan, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { AdminRefreshToken } from './entities/admin-refresh-token.entity';
import {
  ADMIN_JWT_AUDIENCE,
  ADMIN_JWT_ISSUER,
  ADMIN_REFRESH_TTL_MS,
} from './admin.constants';

export interface AdminTokenPair {
  accessToken: string;
  refreshToken: string;
}

interface RefreshPayload {
  sub: string;
  jti: string;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Mints and rotates admin.stiff.ge sessions.
 *
 * Same shape as `TokenService` and `StaffTokenService` — single-use refresh
 * tokens, hashed at rest, and reuse of an already-rotated one revokes the whole
 * family on the assumption it was stolen.
 */
@Injectable()
export class AdminTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(AdminRefreshToken)
    private readonly refreshTokenRepo: Repository<AdminRefreshToken>,
  ) {}

  /** Falls back to the shop secrets; the audience claim is what separates them. */
  get accessSecret(): string | undefined {
    return (
      this.configService.get<string>('ADMIN_JWT_ACCESS_SECRET') ??
      this.configService.get<string>('JWT_ACCESS_SECRET')
    );
  }

  private get refreshSecret(): string | undefined {
    return (
      this.configService.get<string>('ADMIN_JWT_REFRESH_SECRET') ??
      this.configService.get<string>('JWT_REFRESH_SECRET')
    );
  }

  async issueTokenPair(user: User): Promise<AdminTokenPair> {
    const jti = randomUUID();

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, role: user.role },
      {
        secret: this.accessSecret,
        expiresIn: (this.configService.get<string>('JWT_ACCESS_TTL') ??
          '15m') as StringValue,
        audience: ADMIN_JWT_AUDIENCE,
        issuer: ADMIN_JWT_ISSUER,
      },
    );
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, jti },
      {
        secret: this.refreshSecret,
        expiresIn: (this.configService.get<string>('JWT_REFRESH_TTL') ??
          '30d') as StringValue,
        audience: ADMIN_JWT_AUDIENCE,
        issuer: ADMIN_JWT_ISSUER,
      },
    );

    await this.refreshTokenRepo.save({
      id: jti,
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + ADMIN_REFRESH_TTL_MS),
      revokedAt: null,
      replacedById: null,
    });

    return { accessToken, refreshToken };
  }

  async consumeRefreshToken(rawToken: string): Promise<{ userId: string }> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshPayload>(rawToken, {
        secret: this.refreshSecret,
        audience: ADMIN_JWT_AUDIENCE,
        issuer: ADMIN_JWT_ISSUER,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const row = await this.refreshTokenRepo.findOne({
      where: { id: payload.jti },
    });
    if (!row || row.tokenHash !== sha256(rawToken)) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (row.revokedAt) {
      // Token reuse — assume theft, revoke every admin session for this user.
      await this.revokeAllForUser(row.userId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    return { userId: row.userId };
  }

  async markRotated(rawToken: string, replacedById: string): Promise<void> {
    const payload = this.jwtService.decode<RefreshPayload>(rawToken);
    if (!payload?.jti) return;
    await this.refreshTokenRepo.update(
      { id: payload.jti },
      { revokedAt: new Date(), replacedById },
    );
  }

  async revokeByRawToken(rawToken: string): Promise<void> {
    const payload = this.jwtService.decode<RefreshPayload>(rawToken);
    if (!payload?.jti) return;
    await this.refreshTokenRepo.update(
      { id: payload.jti, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /**
   * Ends every admin session for one person. Called on refresh-token reuse and
   * whenever an account stops being an admin — demotion has to take effect on
   * admin.stiff.ge immediately, not whenever the access token happens to lapse.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokenRepo
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where('userId = :userId AND revokedAt IS NULL', { userId })
      .execute();
  }

  jtiOf(rawToken: string): string | undefined {
    return this.jwtService.decode<RefreshPayload>(rawToken)?.jti;
  }

  async purgeStale(): Promise<number> {
    const now = new Date();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const expired = await this.refreshTokenRepo.delete({
      expiresAt: LessThan(now),
    });
    const oldRevoked = await this.refreshTokenRepo.delete({
      revokedAt: LessThan(weekAgo),
    });
    return (expired.affected ?? 0) + (oldRevoked.affected ?? 0);
  }
}
