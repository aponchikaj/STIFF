import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.configService.get<string>('ADMIN_EMAIL')?.toLowerCase();
    const username = this.configService.get<string>('ADMIN_USERNAME');
    const password = this.configService.get<string>('ADMIN_PASSWORD');

    if (!email || !username || !password) {
      this.logger.warn(
        'ADMIN_EMAIL/ADMIN_USERNAME/ADMIN_PASSWORD not fully set — skipping admin seed',
      );
      return;
    }

    try {
      const existing = await this.userRepo.findOne({ where: { email } });
      if (existing) {
        // Never overwrite the password of an existing account.
        if (
          existing.role !== 'admin' ||
          !existing.isVerified ||
          existing.isBlocked
        ) {
          existing.role = 'admin';
          existing.isVerified = true;
          existing.isBlocked = false;
          await this.userRepo.save(existing);
        }
        this.logger.log(`Admin ensured: ${email}`);
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await this.userRepo.save(
        this.userRepo.create({
          username,
          email,
          passwordHash,
          role: 'admin',
          isVerified: true,
        }),
      );
      this.logger.log(`Admin created: ${email}`);
    } catch (err) {
      this.logger.error(
        'Admin seed failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
