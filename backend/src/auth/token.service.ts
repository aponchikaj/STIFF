import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import type { StringValue } from 'ms';
import { IsNull, LessThan, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { RefreshToken } from './refresh-token.entity';

export const ACCESS_COOKIE = 'stiff_access';
export const REFRESH_COOKIE = 'stiff_refresh';
export const ACCESS_TTL_MS = 15 * 60 * 1000;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface TokenPair {
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

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  async issueTokenPair(user: User): Promise<TokenPair> {
    const jti = randomUUID();

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, role: user.role },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_ACCESS_TTL') ??
          '15m') as StringValue,
      },
    );
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, jti },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_REFRESH_TTL') ??
          '30d') as StringValue,
      },
    );

    await this.refreshTokenRepo.save({
      id: jti,
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      revokedAt: null,
      replacedById: null,
    });

    return { accessToken, refreshToken };
  }

  /**
   * Verifies a raw refresh JWT, enforces single-use rotation, and returns the
   * owning user id. Reuse of an already-rotated token revokes the whole family.
   */
  async consumeRefreshToken(rawToken: string): Promise<{ userId: string }> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshPayload>(rawToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
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
      // Token reuse — assume theft, revoke everything for this user.
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

  async revokeAllForUser(userId: string, exceptJti?: string): Promise<void> {
    const qb = this.refreshTokenRepo
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where('userId = :userId AND revokedAt IS NULL', { userId });
    if (exceptJti) qb.andWhere('id != :exceptJti', { exceptJti });
    await qb.execute();
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
