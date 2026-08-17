import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { StaffConversation } from './entities/staff-conversation.entity';
import { StaffConversationMember } from './entities/staff-conversation-member.entity';
import { StaffUser } from './entities/staff-user.entity';
import { normalizeInstagram } from './permissions';
import { STAFF_MAIN_CHANNEL_KEY, STAFF_OWNER_SLUG } from './staff.constants';
import { StaffRolesService } from './staff-roles.service';

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
    private readonly staffRolesService: StaffRolesService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.staffRolesService.ensureDefaults();
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

  private envString(key: string): string | undefined {
    const raw = this.configService.get<string>(key);
    if (!raw) return undefined;
    let value = raw.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }
    return value || undefined;
  }

  private async ensureOwner(): Promise<void> {
    const email = this.envString('STAFF_OWNER_EMAIL')?.toLowerCase();
    const username = this.envString('STAFF_OWNER_USERNAME');
    const password = this.envString('STAFF_OWNER_PASSWORD');
    const instagramRaw = this.envString('STAFF_OWNER_INSTAGRAM');
    const ownerRole =
      await this.staffRolesService.requireBySlug(STAFF_OWNER_SLUG);

    if (!email || !username || !password || !instagramRaw) {
      const owners = await this.userRepo.count({
        where: { roleId: ownerRole.id },
      });
      if (owners === 0) {
        this.logger.warn(
          'STAFF_OWNER_EMAIL/USERNAME/PASSWORD/INSTAGRAM not set — no staff owner seeded',
        );
      }
      return;
    }

    try {
      const instagramUsername = normalizeInstagram(instagramRaw);
      const existing = await this.userRepo.findOne({
        where: { email },
        relations: { assignedRole: true },
      });
      if (existing) {
        if (existing.roleId !== ownerRole.id || existing.isBlocked) {
          existing.roleId = ownerRole.id;
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
          roleId: ownerRole.id,
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
