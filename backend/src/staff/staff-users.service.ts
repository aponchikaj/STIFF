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
  canBlockUser,
  hasPermission,
  isOwner,
  normalizeInstagram,
} from './permissions';
import { STAFF_MEMBER_SLUG } from './staff.constants';
import { StaffSeedService } from './staff-seed.service';
import { StaffRolesService } from './staff-roles.service';
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
    private readonly staffRolesService: StaffRolesService,
  ) {}

  findById(id: string): Promise<StaffUser | null> {
    return this.userRepo.findOne({
      where: { id },
      relations: { assignedRole: true },
    });
  }

  findWithHashByEmailOrUsername(
    emailOrUsername: string,
  ): Promise<StaffUser | null> {
    const value = emailOrUsername.trim();
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.assignedRole', 'assignedRole')
      .where('LOWER(user.email) = LOWER(:value)', { value })
      .orWhere('LOWER(user.username) = LOWER(:value)', { value })
      .getOne();
  }

  findWithHashById(id: string): Promise<StaffUser | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.assignedRole', 'assignedRole')
      .where('user.id = :id', { id })
      .getOne();
  }

  listDirectory(): Promise<SafeStaffUser[]> {
    return this.userRepo
      .find({
        relations: { assignedRole: true },
        order: { username: 'ASC' },
      })
      .then((rows) => rows.map(toSafeStaffUser));
  }

  async createAccount(
    actor: StaffUser,
    dto: CreateStaffUserDto,
  ): Promise<StaffUser> {
    if (!hasPermission(actor, 'people.create')) {
      throw new ForbiddenException('You cannot create staff accounts');
    }
    const role = dto.roleId
      ? await this.staffRolesService.requireById(dto.roleId)
      : await this.staffRolesService.requireBySlug(STAFF_MEMBER_SLUG);
    if (role.isOwner && !hasPermission(actor, 'people.create_owner')) {
      throw new ForbiddenException('You cannot create owner accounts');
    }
    const user = await this.insertUser({
      username: dto.username,
      email: dto.email,
      password: dto.password,
      instagramUsername: dto.instagramUsername,
      roleId: role.id,
      createdById: actor.id,
    });
    await this.staffSeedService.addToMain(user.id);
    return (await this.findById(user.id)) ?? user;
  }

  async insertUser(data: {
    username: string;
    email: string;
    password: string;
    instagramUsername: string;
    roleId: string;
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
      roleId: data.roleId,
      createdById: data.createdById,
      isBlocked: false,
    });
    return this.userRepo.save(user);
  }

  async changeRole(
    actor: StaffUser,
    targetId: string,
    roleId: string,
  ): Promise<SafeStaffUser> {
    if (!hasPermission(actor, 'people.assign_role')) {
      throw new ForbiddenException('You cannot assign roles');
    }
    const role = await this.staffRolesService.requireById(roleId);
    if (role.isOwner && !hasPermission(actor, 'people.create_owner')) {
      throw new ForbiddenException('You cannot assign the owner role');
    }
    const target = await this.requireUser(targetId);
    if (isOwner(target) && !role.isOwner && (await this.ownerCount()) <= 1) {
      throw new ForbiddenException('Cannot demote the last owner');
    }
    target.roleId = role.id;
    target.assignedRole = role;
    await this.userRepo.save(target);
    return toSafeStaffUser(target);
  }

  async setBlocked(
    actor: StaffUser,
    targetId: string,
    blocked: boolean,
  ): Promise<SafeStaffUser> {
    const target = await this.requireUser(targetId);
    if (!canBlockUser(actor, target)) {
      throw new ForbiddenException('You cannot change this account');
    }
    if (blocked && isOwner(target) && (await this.ownerCount()) <= 1) {
      throw new ForbiddenException('Cannot block the last owner');
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
    return toSafeStaffUser((await this.findById(user.id)) ?? user);
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

  private ownerCount(): Promise<number> {
    return this.userRepo
      .createQueryBuilder('user')
      .innerJoin('user.assignedRole', 'role')
      .where('role.isOwner = true')
      .getCount();
  }

  private async requireUser(id: string): Promise<StaffUser> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Staff account not found');
    return user;
  }
}
