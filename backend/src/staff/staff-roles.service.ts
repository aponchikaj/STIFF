import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaffRole } from './entities/staff-role.entity';
import { StaffUser } from './entities/staff-user.entity';
import { CreateStaffRoleDto, UpdateStaffRoleDto } from './dto/staff-roles.dto';
import { hasPermission, slugifyRoleName } from './permissions';
import {
  ADMIN_PERMISSIONS,
  STAFF_ADMIN_SLUG,
  STAFF_MEMBER_SLUG,
  STAFF_OWNER_SLUG,
  STAFF_PERMISSION_CATALOG,
  STAFF_PERMISSION_KEYS,
} from './staff.constants';

@Injectable()
export class StaffRolesService {
  constructor(
    @InjectRepository(StaffRole)
    private readonly roleRepo: Repository<StaffRole>,
    @InjectRepository(StaffUser)
    private readonly userRepo: Repository<StaffUser>,
  ) {}

  catalog() {
    return STAFF_PERMISSION_CATALOG;
  }

  list(): Promise<StaffRole[]> {
    return this.roleRepo.find({ order: { name: 'ASC' } });
  }

  async requireById(id: string): Promise<StaffRole> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async requireBySlug(slug: string): Promise<StaffRole> {
    const role = await this.roleRepo.findOne({ where: { slug } });
    if (!role) throw new NotFoundException(`Role ${slug} is missing`);
    return role;
  }

  async ensureDefaults(): Promise<void> {
    await this.ensureRole(STAFF_OWNER_SLUG, 'Owner', {
      isOwner: true,
      isSystem: true,
      permissions: [...STAFF_PERMISSION_KEYS],
    });
    await this.ensureRole(STAFF_ADMIN_SLUG, 'Admin', {
      isOwner: false,
      isSystem: false,
      permissions: [...ADMIN_PERMISSIONS],
    });
    await this.ensureRole(STAFF_MEMBER_SLUG, 'Member', {
      isOwner: false,
      isSystem: false,
      permissions: [],
    });
  }

  async create(actor: StaffUser, dto: CreateStaffRoleDto): Promise<StaffRole> {
    if (!hasPermission(actor, 'roles.manage')) {
      throw new ForbiddenException('You cannot create roles');
    }
    const name = dto.name.trim();
    const slug = await this.uniqueSlug(slugifyRoleName(name));
    if (slug === STAFF_OWNER_SLUG) {
      throw new BadRequestException('The owner role already exists');
    }
    await this.assertNameFree(name);
    return this.roleRepo.save(
      this.roleRepo.create({
        name,
        slug,
        isOwner: false,
        isSystem: false,
        permissions: dto.permissions ?? [],
      }),
    );
  }

  async update(
    actor: StaffUser,
    id: string,
    dto: UpdateStaffRoleDto,
  ): Promise<StaffRole> {
    if (!hasPermission(actor, 'roles.manage')) {
      throw new ForbiddenException('You cannot edit roles');
    }
    const role = await this.requireById(id);
    if (dto.name && dto.name.trim() !== role.name) {
      const name = dto.name.trim();
      await this.assertNameFree(name, role.id);
      role.name = name;
      if (!role.isOwner) {
        role.slug = await this.uniqueSlug(slugifyRoleName(name), role.id);
      }
    }
    if (dto.permissions && !role.isOwner) {
      role.permissions = dto.permissions;
    }
    return this.roleRepo.save(role);
  }

  async remove(actor: StaffUser, id: string): Promise<void> {
    if (!hasPermission(actor, 'roles.manage')) {
      throw new ForbiddenException('You cannot delete roles');
    }
    const role = await this.requireById(id);
    if (role.isOwner || role.isSystem) {
      throw new ForbiddenException('This role cannot be deleted');
    }
    const inUse = await this.userRepo.count({ where: { roleId: id } });
    if (inUse > 0) {
      throw new ConflictException('Reassign people before deleting this role');
    }
    await this.roleRepo.delete({ id });
  }

  private async ensureRole(
    slug: string,
    name: string,
    data: Pick<StaffRole, 'isOwner' | 'isSystem' | 'permissions'>,
  ): Promise<StaffRole> {
    const existing = await this.roleRepo.findOne({ where: { slug } });
    if (existing) {
      if (
        data.isOwner &&
        (!existing.isOwner || existing.permissions.length === 0)
      ) {
        existing.isOwner = true;
        existing.isSystem = true;
        existing.permissions = [...STAFF_PERMISSION_KEYS];
        return this.roleRepo.save(existing);
      }
      return existing;
    }
    return this.roleRepo.save(
      this.roleRepo.create({
        name,
        slug,
        isOwner: data.isOwner,
        isSystem: data.isSystem,
        permissions: data.permissions,
      }),
    );
  }

  private async assertNameFree(name: string, exceptId?: string): Promise<void> {
    const taken = await this.roleRepo
      .createQueryBuilder('role')
      .where('LOWER(role.name) = LOWER(:name)', { name })
      .andWhere(exceptId ? 'role.id != :exceptId' : '1=1', { exceptId })
      .getOne();
    if (taken)
      throw new ConflictException('A role with that name already exists');
  }

  private async uniqueSlug(base: string, exceptId?: string): Promise<string> {
    let slug = base;
    let n = 2;
    while (true) {
      const existing = await this.roleRepo.findOne({ where: { slug } });
      if (!existing || existing.id === exceptId) return slug;
      slug = `${base}_${n}`;
      n += 1;
    }
  }
}
