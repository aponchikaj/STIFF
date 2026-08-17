import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { StaffRefreshToken } from './entities/staff-refresh-token.entity';
import {
  SafeStaffUser,
  StaffUser,
  toSafeStaffUser,
} from './entities/staff-user.entity';
import {
  canAssignRole,
  canBlockUser,
  canCreateRole,
  normalizeInstagram,
} from './permissions';
import type { StaffRole } from './staff.constants';
import { StaffSeedService } from './staff-seed.service';
import {
  ChangeStaffPasswordDto,
  CreateStaffUserDto,
  UpdateStaffProfileDto,
} from './dto/staff-users.dto';

@Injectable()
export class StaffUsersService {
  constructor(
    @InjectRepository(StaffUser)
    private readonly userRepo: Repository<StaffUser>,
    @InjectRepository(StaffRefreshToken)
    private readonly refreshTokenRepo: Repository<StaffRefreshToken>,
    private readonly staffSeedService: StaffSeedService,
  ) {}

  findById(id: string): Promise<StaffUser | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  findWithHashByEmailOrUsername(
    emailOrUsername: string,
  ): Promise<StaffUser | null> {
    const value = emailOrUsername.trim();
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = LOWER(:value)', { value })
      .orWhere('LOWER(user.username) = LOWER(:value)', { value })
      .getOne();
  }

  findWithHashById(id: string): Promise<StaffUser | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();
  }

  listDirectory(): Promise<SafeStaffUser[]> {
    return this.userRepo
      .find({ order: { username: 'ASC' } })
      .then((rows) => rows.map(toSafeStaffUser));
  }

  async createAccount(
    actor: StaffUser,
    dto: CreateStaffUserDto,
  ): Promise<StaffUser> {
    const role: StaffRole = dto.role ?? 'member';
    if (!canCreateRole(actor.role, role)) {
      throw new ForbiddenException('You cannot create this role');
    }
    const user = await this.insertUser({
      username: dto.username,
      email: dto.email,
      password: dto.password,
      instagramUsername: dto.instagramUsername,
      role,
      createdById: actor.id,
    });
    await this.staffSeedService.addToMain(user.id);
    return user;
  }

  async insertUser(data: {
    username: string;
    email: string;
    password: string;
    instagramUsername: string;
    role: StaffRole;
    createdById: string | null;
  }): Promise<StaffUser> {
    const email = data.email.toLowerCase().trim();
    const username = data.username.trim();
    const instagramUsername = normalizeInstagram(data.instagramUsername);

    if (!instagramUsername) {
      throw new ConflictException('Instagram username is required');
    }

    const existingEmail = await this.userRepo.findOne({ where: { email } });
    if (existingEmail) throw new ConflictException('Email already in use');

    const existingUsername = await this.userRepo
      .createQueryBuilder('user')
      .where('LOWER(user.username) = LOWER(:username)', { username })
      .getOne();
    if (existingUsername) throw new ConflictException('Username already taken');

    const existingIg = await this.userRepo.findOne({
      where: { instagramUsername },
    });
    if (existingIg) {
      throw new ConflictException('Instagram username already in use');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = this.userRepo.create({
      username,
      email,
      instagramUsername,
      passwordHash,
      role: data.role,
      createdById: data.createdById,
      isBlocked: false,
    });
    return this.userRepo.save(user);
  }

  async changeRole(
    actor: StaffUser,
    targetId: string,
    role: StaffRole,
  ): Promise<SafeStaffUser> {
    if (!canAssignRole(actor.role)) {
      throw new ForbiddenException('Only an owner can assign roles');
    }
    if (actor.id === targetId && role !== 'owner') {
      const owners = await this.userRepo.count({ where: { role: 'owner' } });
      if (owners <= 1) {
        throw new ForbiddenException('Cannot demote the last owner');
      }
    }
    const target = await this.requireUser(targetId);
    target.role = role;
    await this.userRepo.save(target);
    return toSafeStaffUser(target);
  }

  async setBlocked(
    actor: StaffUser,
    targetId: string,
    blocked: boolean,
  ): Promise<SafeStaffUser> {
    const target = await this.requireUser(targetId);
    if (!canBlockUser(actor.role, target.role, actor.id, target.id)) {
      throw new ForbiddenException('You cannot change this account');
    }
    if (blocked && target.role === 'owner') {
      const owners = await this.userRepo.count({ where: { role: 'owner' } });
      if (owners <= 1) {
        throw new ForbiddenException('Cannot block the last owner');
      }
    }
    target.isBlocked = blocked;
    await this.userRepo.save(target);
    if (blocked) {
      await this.refreshTokenRepo
        .createQueryBuilder()
        .update()
        .set({ revokedAt: new Date() })
        .where('userId = :userId AND revokedAt IS NULL', { userId: target.id })
        .execute();
    }
    return toSafeStaffUser(target);
  }

  async updateProfile(
    user: StaffUser,
    dto: UpdateStaffProfileDto,
  ): Promise<SafeStaffUser> {
    if (dto.username && dto.username !== user.username) {
      const taken = await this.userRepo
        .createQueryBuilder('u')
        .where('LOWER(u.username) = LOWER(:username)', {
          username: dto.username,
        })
        .andWhere('u.id != :id', { id: user.id })
        .getOne();
      if (taken) throw new ConflictException('Username already taken');
      user.username = dto.username.trim();
    }
    if (dto.instagramUsername) {
      const ig = normalizeInstagram(dto.instagramUsername);
      const taken = await this.userRepo
        .createQueryBuilder('u')
        .where('u.instagramUsername = :ig', { ig })
        .andWhere('u.id != :id', { id: user.id })
        .getOne();
      if (taken) {
        throw new ConflictException('Instagram username already in use');
      }
      user.instagramUsername = ig;
    }
    await this.userRepo.save(user);
    return toSafeStaffUser(user);
  }

  async changePassword(
    user: StaffUser,
    dto: ChangeStaffPasswordDto,
  ): Promise<void> {
    const withHash = await this.findWithHashById(user.id);
    if (!withHash) throw new NotFoundException('Account not found');
    const ok = await bcrypt.compare(dto.currentPassword, withHash.passwordHash);
    if (!ok) throw new UnauthorizedException('Current password is wrong');
    withHash.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepo.save(withHash);
    await this.refreshTokenRepo
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where('userId = :userId AND revokedAt IS NULL', { userId: user.id })
      .execute();
  }

  private async requireUser(id: string): Promise<StaffUser> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Staff account not found');
    return user;
  }
}
