import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate, Paginated } from '../common/types/paginated';
import { StaffMessagesQueryDto } from './dto/staff-chat.dto';
import { StaffConversation } from './entities/staff-conversation.entity';
import { StaffConversationMember } from './entities/staff-conversation-member.entity';
import { StaffMessage } from './entities/staff-message.entity';
import {
  SafeStaffUser,
  StaffUser,
  toSafeStaffUser,
} from './entities/staff-user.entity';
import { dmKeyFor } from './permissions';
import { STAFF_MAIN_CHANNEL_KEY } from './staff.constants';
import { StaffSeedService } from './staff-seed.service';
import { StaffUsersService } from './staff-users.service';

export interface StaffMessageView {
  id: string;
  conversationId: string;
  body: string;
  createdAt: Date;
  sender: SafeStaffUser;
}

export interface StaffConversationView {
  id: string;
  type: 'main' | 'dm';
  lastMessage: StaffMessageView | null;
  unreadCount: number;
  peer: SafeStaffUser | null;
  updatedAt: Date;
}

@Injectable()
export class StaffChatService {
  constructor(
    @InjectRepository(StaffConversation)
    private readonly conversationRepo: Repository<StaffConversation>,
    @InjectRepository(StaffConversationMember)
    private readonly memberRepo: Repository<StaffConversationMember>,
    @InjectRepository(StaffMessage)
    private readonly messageRepo: Repository<StaffMessage>,
    private readonly staffUsersService: StaffUsersService,
    private readonly staffSeedService: StaffSeedService,
  ) {}

  async listConversations(user: StaffUser): Promise<StaffConversationView[]> {
    await this.staffSeedService.addToMain(user.id);

    const memberships = await this.memberRepo.find({
      where: { userId: user.id },
      relations: { conversation: true },
    });

    const views: StaffConversationView[] = [];
    for (const membership of memberships) {
      views.push(await this.toConversationView(membership, user.id));
    }

    return views.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getMain(user: StaffUser): Promise<StaffConversationView> {
    await this.staffSeedService.addToMain(user.id);
    const main = await this.requireMain();
    const membership = await this.requireMembership(main.id, user.id);
    return this.toConversationView(membership, user.id);
  }

  async openDm(
    user: StaffUser,
    otherUserId: string,
  ): Promise<StaffConversationView> {
    if (user.id === otherUserId) {
      throw new BadRequestException('Cannot message yourself');
    }
    const other = await this.staffUsersService.findById(otherUserId);
    if (!other || other.isBlocked) {
      throw new NotFoundException('Staff member not found');
    }

    const key = dmKeyFor(user.id, other.id);
    let conversation = await this.conversationRepo.findOne({
      where: { dmKey: key },
    });
    if (!conversation) {
      conversation = await this.conversationRepo.save(
        this.conversationRepo.create({ type: 'dm', dmKey: key }),
      );
      await this.memberRepo.save([
        this.memberRepo.create({
          conversationId: conversation.id,
          userId: user.id,
          lastReadAt: null,
        }),
        this.memberRepo.create({
          conversationId: conversation.id,
          userId: other.id,
          lastReadAt: null,
        }),
      ]);
    } else {
      await this.ensureMember(conversation.id, user.id);
      await this.ensureMember(conversation.id, other.id);
    }

    const membership = await this.requireMembership(conversation.id, user.id);
    membership.conversation = conversation;
    return this.toConversationView(membership, user.id);
  }

  async listMessages(
    user: StaffUser,
    conversationId: string,
    query: StaffMessagesQueryDto,
  ): Promise<Paginated<StaffMessageView>> {
    await this.requireMembership(conversationId, user.id);
    const [rows, total] = await this.messageRepo.findAndCount({
      where: { conversationId },
      relations: { sender: true },
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.pageSize,
    });
    return paginate(
      rows.map((row) => this.toMessageView(row)).reverse(),
      total,
      query.page,
      query.pageSize,
    );
  }

  async sendMessage(
    user: StaffUser,
    conversationId: string,
    body: string,
  ): Promise<StaffMessageView> {
    await this.requireMembership(conversationId, user.id);
    const trimmed = body.trim();
    if (!trimmed) throw new BadRequestException('Message cannot be empty');

    const saved = await this.messageRepo.save(
      this.messageRepo.create({
        conversationId,
        senderId: user.id,
        body: trimmed,
      }),
    );
    saved.sender = user;
    await this.memberRepo.update(
      { conversationId, userId: user.id },
      { lastReadAt: new Date() },
    );
    return this.toMessageView(saved);
  }

  async markRead(user: StaffUser, conversationId: string): Promise<void> {
    await this.requireMembership(conversationId, user.id);
    await this.memberRepo.update(
      { conversationId, userId: user.id },
      { lastReadAt: new Date() },
    );
  }

  async memberIds(conversationId: string): Promise<string[]> {
    const rows = await this.memberRepo.find({ where: { conversationId } });
    return rows.map((row) => row.userId);
  }

  private async requireMain(): Promise<StaffConversation> {
    const main = await this.conversationRepo.findOne({
      where: { dmKey: STAFF_MAIN_CHANNEL_KEY },
    });
    if (!main) throw new NotFoundException('Main channel is not ready');
    return main;
  }

  private async requireMembership(
    conversationId: string,
    userId: string,
  ): Promise<StaffConversationMember> {
    const membership = await this.memberRepo.findOne({
      where: { conversationId, userId },
      relations: { conversation: true },
    });
    if (!membership) {
      throw new ForbiddenException('You are not in this conversation');
    }
    return membership;
  }

  private async ensureMember(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const existing = await this.memberRepo.findOne({
      where: { conversationId, userId },
    });
    if (existing) return;
    await this.memberRepo.save(
      this.memberRepo.create({ conversationId, userId, lastReadAt: null }),
    );
  }

  private async toConversationView(
    membership: StaffConversationMember,
    userId: string,
  ): Promise<StaffConversationView> {
    const conversation =
      membership.conversation ??
      (await this.conversationRepo.findOneByOrFail({
        id: membership.conversationId,
      }));

    const last = await this.messageRepo.findOne({
      where: { conversationId: conversation.id },
      relations: { sender: true },
      order: { createdAt: 'DESC' },
    });

    const unreadQb = this.messageRepo
      .createQueryBuilder('m')
      .where('m.conversationId = :cid', { cid: conversation.id })
      .andWhere('m.senderId != :uid', { uid: userId });
    if (membership.lastReadAt) {
      unreadQb.andWhere('m.createdAt > :read', {
        read: membership.lastReadAt,
      });
    }
    const unreadCount = await unreadQb.getCount();

    let peer: SafeStaffUser | null = null;
    if (conversation.type === 'dm') {
      const members = await this.memberRepo.find({
        where: { conversationId: conversation.id },
      });
      const otherId = members.find((m) => m.userId !== userId)?.userId;
      if (otherId) {
        const other = await this.staffUsersService.findById(otherId);
        if (other) peer = toSafeStaffUser(other);
      }
    }

    return {
      id: conversation.id,
      type: conversation.type,
      lastMessage: last ? this.toMessageView(last) : null,
      unreadCount,
      peer,
      updatedAt: last?.createdAt ?? conversation.createdAt,
    };
  }

  private toMessageView(message: StaffMessage): StaffMessageView {
    return {
      id: message.id,
      conversationId: message.conversationId,
      body: message.body,
      createdAt: message.createdAt,
      sender: toSafeStaffUser(message.sender),
    };
  }
}
