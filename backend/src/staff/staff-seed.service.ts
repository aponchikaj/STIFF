import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { StaffConversation } from './entities/staff-conversation.entity';
import { StaffConversationMember } from './entities/staff-conversation-member.entity';
import { StaffUser } from './entities/staff-user.entity';
import { normalizeInstagram } from './permissions';
import { STAFF_MAIN_CHANNEL_KEY } from './staff.constants';

@Injectable()
export class StaffSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StaffSeedService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(StaffUser)
    private readonly userRepo: Repository<StaffUser>,
    @InjectRepository(StaffConversation)
    private readonly conversationRepo: Repository<StaffConversation>,
    @InjectRepository(StaffConversationMember)
    private readonly memberRepo: Repository<StaffConversationMember>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureMainChannel();
    await this.ensureOwner();
  }

  private async ensureMainChannel(): Promise<StaffConversation> {
    let main = await this.conversationRepo.findOne({
      where: { dmKey: STAFF_MAIN_CHANNEL_KEY },
    });
    if (!main) {
      main = await this.conversationRepo.save(
        this.conversationRepo.create({
          type: 'main',
          dmKey: STAFF_MAIN_CHANNEL_KEY,
        }),
      );
      this.logger.log('Staff main channel created');
    }
    return main;
  }

  private async ensureOwner(): Promise<void> {
    const email = this.configService
      .get<string>('STAFF_OWNER_EMAIL')
      ?.toLowerCase();
    const username = this.configService.get<string>('STAFF_OWNER_USERNAME');
    const password = this.configService.get<string>('STAFF_OWNER_PASSWORD');
    const instagramRaw = this.configService.get<string>(
      'STAFF_OWNER_INSTAGRAM',
    );

    if (!email || !username || !password || !instagramRaw) {
      const owners = await this.userRepo.count({ where: { role: 'owner' } });
      if (owners === 0) {
        this.logger.warn(
          'STAFF_OWNER_EMAIL/USERNAME/PASSWORD/INSTAGRAM not set — no staff owner seeded',
        );
      }
      return;
    }

    try {
      const instagramUsername = normalizeInstagram(instagramRaw);
      const existing = await this.userRepo.findOne({ where: { email } });
      if (existing) {
        if (existing.role !== 'owner' || existing.isBlocked) {
          existing.role = 'owner';
          existing.isBlocked = false;
          await this.userRepo.save(existing);
        }
        await this.addToMain(existing.id);
        this.logger.log(`Staff owner ensured: ${email}`);
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const owner = await this.userRepo.save(
        this.userRepo.create({
          username,
          email,
          instagramUsername,
          passwordHash,
          role: 'owner',
          createdById: null,
        }),
      );
      await this.addToMain(owner.id);
      this.logger.log(`Staff owner created: ${email}`);
    } catch (err) {
      this.logger.error(
        'Staff owner seed failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  async addToMain(userId: string): Promise<void> {
    const main = await this.ensureMainChannel();
    const already = await this.memberRepo.findOne({
      where: { conversationId: main.id, userId },
    });
    if (already) return;
    await this.memberRepo.save(
      this.memberRepo.create({
        conversationId: main.id,
        userId,
        lastReadAt: null,
      }),
    );
  }
}
