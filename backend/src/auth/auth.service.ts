import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { EmailToken, EmailTokenType } from './email-token.entity';

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    @InjectRepository(EmailToken)
    private readonly emailTokenRepo: Repository<EmailToken>,
  ) {}

  async register(dto: RegisterDto): Promise<User> {
    const user = await this.usersService.createUser({
      username: dto.username,
      email: dto.email,
      password: dto.password,
    });
    await this.sendVerification(user);
    return user;
  }

  async login(dto: LoginDto): Promise<User> {
    const user = await this.usersService.findWithHashByEmailOrUsername(
      dto.emailOrUsername,
    );
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    if (user.isBlocked) throw new ForbiddenException('Account is blocked');
    return user;
  }

  async sendVerification(user: User): Promise<void> {
    if (user.isVerified) return;
    // Invalidate outstanding verify tokens so only the newest link works.
    await this.emailTokenRepo.update(
      { userId: user.id, type: 'verify', usedAt: IsNull() },
      { usedAt: new Date() },
    );
    const raw = await this.createToken(user.id, 'verify', VERIFY_TTL_MS);
    await this.mailService.sendVerificationEmail(user.email, raw);
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const token = await this.findValidToken(rawToken, 'verify');
    if (!token) {
      throw new BadRequestException('Invalid or expired verification link');
    }
    await this.usersService.setVerified(token.userId);
    await this.emailTokenRepo.update({ id: token.id }, { usedAt: new Date() });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    // Always succeed from the caller's perspective — no user enumeration.
    if (!user || user.isBlocked) return;
    const raw = await this.createToken(user.id, 'reset', RESET_TTL_MS);
    await this.mailService.sendPasswordResetEmail(user.email, raw);
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const token = await this.findValidToken(rawToken, 'reset');
    if (!token) {
      throw new BadRequestException('Invalid or expired reset link');
    }
    await this.usersService.setPassword(token.userId, newPassword);
    await this.emailTokenRepo.update({ id: token.id }, { usedAt: new Date() });
    await this.usersService.revokeAllRefreshTokens(token.userId);
  }

  private async createToken(
    userId: string,
    type: EmailTokenType,
    ttlMs: number,
  ): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    await this.emailTokenRepo.save(
      this.emailTokenRepo.create({
        userId,
        type,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + ttlMs),
        usedAt: null,
      }),
    );
    return raw;
  }

  private findValidToken(
    rawToken: string,
    type: EmailTokenType,
  ): Promise<EmailToken | null> {
    return this.emailTokenRepo.findOne({
      where: {
        tokenHash: sha256(rawToken),
        type,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  /** Purge expired or used email tokens (cron). */
  async purgeStaleEmailTokens(): Promise<number> {
    const result = await this.emailTokenRepo
      .createQueryBuilder()
      .delete()
      .where('expiresAt < NOW() OR usedAt IS NOT NULL')
      .execute();
    return result.affected ?? 0;
  }
}
