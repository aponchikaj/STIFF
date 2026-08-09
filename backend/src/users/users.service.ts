import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { In, IsNull, Not, Repository } from 'typeorm';
import { RefreshToken } from '../auth/refresh-token.entity';
import { Comment } from '../comments/comment.entity';
import { Paginated, paginate } from '../common/types/paginated';
import { Order } from '../orders/order.entity';
import { Reaction } from '../reactions/reaction.entity';
import {
  ChangePasswordDto,
  ListUsersQueryDto,
  MyReactionsQueryDto,
  UpdateProfileDto,
} from './dto/users.dto';
import { SafeUser, toSafeUser, User, UserRole } from './user.entity';
import { PaginationDto } from '../common/dto/pagination.dto';

const REVENUE_STATUSES = ['paid', 'shipped', 'delivered'];

export interface UserStats {
  totalSpentCents: number;
  ordersCount: number;
  commentsCount: number;
  likesGivenCount: number;
  memberSince: Date;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Reaction)
    private readonly reactionRepo: Repository<Reaction>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email: email.toLowerCase() } });
  }

  /** Includes the passwordHash column — for credential checks only. */
  findWithHashByEmailOrUsername(emailOrUsername: string): Promise<User | null> {
    const value = emailOrUsername.trim();
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = LOWER(:value)', { value })
      .orWhere('LOWER(user.username) = LOWER(:value)', { value })
      .getOne();
  }

  findWithHashById(id: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();
  }

  async createUser(data: {
    username: string;
    email: string;
    password: string;
    role?: UserRole;
    isVerified?: boolean;
  }): Promise<User> {
    const email = data.email.toLowerCase();
    const existingEmail = await this.userRepo.findOne({ where: { email } });
    if (existingEmail) throw new ConflictException('Email already in use');
    const existingUsername = await this.userRepo
      .createQueryBuilder('user')
      .where('LOWER(user.username) = LOWER(:username)', {
        username: data.username,
      })
      .getOne();
    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = this.userRepo.create({
      username: data.username,
      email,
      passwordHash,
      role: data.role ?? 'user',
      isVerified: data.isVerified ?? false,
    });
    return this.userRepo.save(user);
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.findWithHashById(userId);
    if (!user) return false;
    return bcrypt.compare(password, user.passwordHash);
  }

  async setVerified(userId: string): Promise<void> {
    await this.userRepo.update({ id: userId }, { isVerified: true });
  }

  async setPassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.update({ id: userId }, { passwordHash });
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.refreshTokenRepo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  // ---------- profile ----------

  async updateProfile(user: User, dto: UpdateProfileDto): Promise<SafeUser> {
    if (dto.username && dto.username !== user.username) {
      const taken = await this.userRepo
        .createQueryBuilder('user')
        .where('LOWER(user.username) = LOWER(:username)', {
          username: dto.username,
        })
        .andWhere('user.id != :id', { id: user.id })
        .getOne();
      if (taken) throw new ConflictException('Username already taken');
      user.username = dto.username;
      await this.userRepo.save(user);
    }
    return toSafeUser(user);
  }

  async changePassword(user: User, dto: ChangePasswordDto): Promise<void> {
    const ok = await this.verifyPassword(user.id, dto.currentPassword);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');
    await this.setPassword(user.id, dto.newPassword);
    await this.revokeAllRefreshTokens(user.id);
  }

  async getStats(user: User): Promise<UserStats> {
    const [spentRow, ordersCount, commentsCount, likesGivenCount] =
      await Promise.all([
        this.orderRepo
          .createQueryBuilder('order')
          .select('COALESCE(SUM(order.totalCents), 0)', 'total')
          .where('order.userId = :userId', { userId: user.id })
          .andWhere('order.status IN (:...statuses)', {
            statuses: REVENUE_STATUSES,
          })
          .getRawOne<{ total: string }>(),
        this.orderRepo.count({ where: { userId: user.id } }),
        this.commentRepo.count({ where: { userId: user.id } }),
        this.reactionRepo.count({ where: { userId: user.id, type: 'like' } }),
      ]);

    return {
      totalSpentCents: Number(spentRow?.total ?? 0),
      ordersCount,
      commentsCount,
      likesGivenCount,
      memberSince: user.createdAt,
    };
  }

  async getMyOrders(
    userId: string,
    query: PaginationDto,
  ): Promise<Paginated<Order>> {
    const [items, total] = await this.orderRepo.findAndCount({
      where: { userId },
      relations: { items: true },
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.pageSize,
    });
    return paginate(items, total, query.page, query.pageSize);
  }

  async getMyComments(
    userId: string,
    query: PaginationDto,
  ): Promise<Paginated<Comment>> {
    const [items, total] = await this.commentRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.pageSize,
    });
    return paginate(items, total, query.page, query.pageSize);
  }

  async getMyReactions(
    userId: string,
    query: MyReactionsQueryDto,
  ): Promise<Paginated<Reaction>> {
    const [items, total] = await this.reactionRepo.findAndCount({
      where: query.type ? { userId, type: query.type } : { userId },
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.pageSize,
    });
    return paginate(items, total, query.page, query.pageSize);
  }

  async deleteOwnAccount(user: User, password: string): Promise<void> {
    const ok = await this.verifyPassword(user.id, password);
    if (!ok) throw new UnauthorizedException('Password is incorrect');
    await this.userRepo.delete({ id: user.id });
  }

  // ---------- settings ----------

  static readonly DEFAULT_SETTINGS = {
    theme: 'light',
    emailNotifications: true,
  };

  getSettings(user: User): Record<string, unknown> {
    return { ...UsersService.DEFAULT_SETTINGS, ...(user.settings ?? {}) };
  }

  async updateSettings(
    user: User,
    patch: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    user.settings = { ...(user.settings ?? {}), ...patch };
    await this.userRepo.save(user);
    return this.getSettings(user);
  }

  // ---------- admin ----------

  async adminList(
    query: ListUsersQueryDto,
  ): Promise<
    Paginated<SafeUser & { isBlocked: boolean; ordersCount: number }>
  > {
    const qb = this.userRepo.createQueryBuilder('user');
    if (query.search) {
      qb.andWhere('(user.username ILIKE :search OR user.email ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    if (query.role) qb.andWhere('user.role = :role', { role: query.role });
    if (query.blocked !== undefined) {
      qb.andWhere('user.isBlocked = :blocked', { blocked: query.blocked });
    }
    qb.orderBy('user.createdAt', 'DESC').skip(query.skip).take(query.pageSize);

    const [users, total] = await qb.getManyAndCount();

    const ids = users.map((u) => u.id);
    const counts = new Map<string, number>();
    if (ids.length > 0) {
      const rows = await this.orderRepo
        .createQueryBuilder('order')
        .select('order.userId', 'userId')
        .addSelect('COUNT(*)', 'count')
        .where('order.userId IN (:...ids)', { ids })
        .groupBy('order.userId')
        .getRawMany<{ userId: string; count: string }>();
      for (const row of rows) counts.set(row.userId, Number(row.count));
    }

    const items = users.map((u) => ({
      ...toSafeUser(u),
      isBlocked: u.isBlocked,
      ordersCount: counts.get(u.id) ?? 0,
    }));
    return paginate(items, total, query.page, query.pageSize);
  }

  async adminGet(
    id: string,
  ): Promise<SafeUser & { isBlocked: boolean; stats: UserStats }> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    const stats = await this.getStats(user);
    return { ...toSafeUser(user), isBlocked: user.isBlocked, stats };
  }

  async adminSetBlocked(
    id: string,
    blocked: boolean,
    actingAdmin: User,
  ): Promise<SafeUser & { isBlocked: boolean }> {
    if (id === actingAdmin.id && blocked) {
      throw new BadRequestException('You cannot block yourself');
    }
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    user.isBlocked = blocked;
    await this.userRepo.save(user);
    if (blocked) await this.revokeAllRefreshTokens(id);
    return { ...toSafeUser(user), isBlocked: user.isBlocked };
  }

  async adminSetRole(
    id: string,
    role: UserRole,
    actingAdmin: User,
  ): Promise<SafeUser> {
    if (id === actingAdmin.id && role !== 'admin') {
      throw new BadRequestException('You cannot demote yourself');
    }
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    user.role = role;
    await this.userRepo.save(user);
    return toSafeUser(user);
  }

  async adminDelete(id: string, actingAdmin: User): Promise<void> {
    if (id === actingAdmin.id) {
      throw new BadRequestException('You cannot delete yourself');
    }
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    await this.userRepo.delete({ id });
  }

  /** All non-blocked user ids — for broadcast notifications. */
  async allActiveUserIds(): Promise<string[]> {
    const rows = await this.userRepo.find({
      select: { id: true },
      where: { isBlocked: false },
    });
    return rows.map((r) => r.id);
  }

  countSignupsBetween(from: Date, to: Date): Promise<number> {
    return this.userRepo
      .createQueryBuilder('user')
      .where('user.createdAt >= :from AND user.createdAt < :to', { from, to })
      .getCount();
  }

  /** Unverified accounts older than `days` with no orders (cron cleanup). */
  async deleteStaleUnverified(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const stale = await this.userRepo
      .createQueryBuilder('user')
      .select('user.id')
      .where('user.isVerified = false')
      .andWhere('user.role != :admin', { admin: 'admin' })
      .andWhere('user.createdAt < :cutoff', { cutoff })
      .getMany();
    if (stale.length === 0) return 0;

    const withOrders = await this.orderRepo.find({
      select: { userId: true },
      where: { userId: In(stale.map((u) => u.id)), id: Not(IsNull()) },
    });
    const protectedIds = new Set(withOrders.map((o) => o.userId));
    const deletable = stale.filter((u) => !protectedIds.has(u.id));
    if (deletable.length === 0) return 0;

    await this.userRepo.delete({ id: In(deletable.map((u) => u.id)) });
    return deletable.length;
  }
}
