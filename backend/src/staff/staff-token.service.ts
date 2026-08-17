import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import type { StringValue } from 'ms';
import { IsNull, LessThan, Repository } from 'typeorm';
import { StaffRefreshToken } from './entities/staff-refresh-token.entity';
import { StaffUser } from './entities/staff-user.entity';
import {
  STAFF_JWT_AUDIENCE,
  STAFF_JWT_ISSUER,
  STAFF_REFRESH_TTL_MS,
} from './staff.constants';

export interface StaffTokenPair {
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
export class StaffTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(StaffRefreshToken)
    private readonly refreshTokenRepo: Repository<StaffRefreshToken>,
  ) {}

  async issueTokenPair(user: StaffUser): Promise<StaffTokenPair> {
    const jti = randomUUID();
    const accessSecret =
      this.configService.get<string>('STAFF_JWT_ACCESS_SECRET') ??
      this.configService.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret =
      this.configService.get<string>('STAFF_JWT_REFRESH_SECRET') ??
      this.configService.get<string>('JWT_REFRESH_SECRET');

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, role: user.assignedRole?.slug ?? 'member' },
      {
        secret: accessSecret,
        expiresIn: (this.configService.get<string>('JWT_ACCESS_TTL') ??
          '15m') as StringValue,
        audience: STAFF_JWT_AUDIENCE,
        issuer: STAFF_JWT_ISSUER,
      },
    );
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, jti },
      {
        secret: refreshSecret,
        expiresIn: (this.configService.get<string>('JWT_REFRESH_TTL') ??
          '30d') as StringValue,
        audience: STAFF_JWT_AUDIENCE,
        issuer: STAFF_JWT_ISSUER,
      },
    );

    await this.refreshTokenRepo.save({
      id: jti,
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + STAFF_REFRESH_TTL_MS),
      revokedAt: null,
      replacedById: null,
    });

    return { accessToken, refreshToken };
  }

  async consumeRefreshToken(rawToken: string): Promise<{ userId: string }> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshPayload>(rawToken, {
        secret:
          this.configService.get<string>('STAFF_JWT_REFRESH_SECRET') ??
          this.configService.get<string>('JWT_REFRESH_SECRET'),
        audience: STAFF_JWT_AUDIENCE,
        issuer: STAFF_JWT_ISSUER,
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
