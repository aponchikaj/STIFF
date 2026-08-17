import {
  canAssignTaskTo,
  canBlockUser,
  canDeleteTask,
  canEditTask,
  canViewOthersBoards,
  dmKeyFor,
  hasPermission,
  normalizeInstagram,
  slugifyRoleName,
} from './permissions';
import { STAFF_PERMISSION_KEYS } from './staff.constants';
import type { StaffUser } from './entities/staff-user.entity';

function user(
  partial: Partial<StaffUser> & {
    assignedRole: StaffUser['assignedRole'];
  },
): StaffUser {
  return {
    id: 'me',
    username: 'me',
    email: 'me@stiff.ge',
    instagramUsername: 'me',
    passwordHash: '',
    roleId: partial.assignedRole.id,
    isBlocked: false,
    createdById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

const ownerRole = {
  id: 'r-owner',
  name: 'Owner',
  slug: 'owner',
  isOwner: true,
  isSystem: true,
  permissions: [...STAFF_PERMISSION_KEYS],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const adminRole = {
  id: 'r-admin',
  name: 'Admin',
  slug: 'admin',
  isOwner: false,
  isSystem: false,
  permissions: [
    'people.view',
    'people.create',
    'people.block',
    'tasks.view_others',
    'tasks.assign',
    'tasks.edit_others',
    'tasks.delete_others',
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const memberRole = {
  id: 'r-member',
  name: 'Member',
  slug: 'member',
  isOwner: false,
  isSystem: false,
  permissions: [] as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const packingRole = {
  id: 'r-pack',
  name: 'Packing',
  slug: 'packing',
  isOwner: false,
  isSystem: false,
  permissions: ['tasks.view_others', 'tasks.assign'] as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('staff permissions', () => {
  const owner = user({ id: 'owner', assignedRole: ownerRole });
  const admin = user({ id: 'admin', assignedRole: adminRole });
  const member = user({ id: 'me', assignedRole: memberRole });
  const packer = user({ id: 'pack', assignedRole: packingRole });

  it('gives owners every function, including creating other owners', () => {
    expect(hasPermission(owner, 'people.create_owner')).toBe(true);
    expect(hasPermission(owner, 'roles.manage')).toBe(true);
    expect(hasPermission(admin, 'people.create_owner')).toBe(false);
    expect(hasPermission(admin, 'people.create')).toBe(true);
    expect(hasPermission(member, 'people.create')).toBe(false);
  });

  it('lets a named role only use the functions it was given', () => {
    expect(hasPermission(packer, 'tasks.assign')).toBe(true);
    expect(hasPermission(packer, 'people.create')).toBe(false);
    expect(canViewOthersBoards(packer)).toBe(true);
    expect(canViewOthersBoards(member)).toBe(false);
  });

  it('blocks the right people and never yourself', () => {
    expect(canBlockUser(owner, admin)).toBe(true);
    expect(canBlockUser(owner, owner)).toBe(false);
    expect(canBlockUser(admin, member)).toBe(true);
    expect(canBlockUser(admin, owner)).toBe(false);
    expect(canBlockUser(member, admin)).toBe(false);
  });

  it('keeps members on their own task board unless assigned', () => {
    expect(canAssignTaskTo(member, 'me')).toBe(true);
    expect(canAssignTaskTo(member, 'other')).toBe(false);
    expect(canAssignTaskTo(admin, 'other')).toBe(true);
    expect(canAssignTaskTo(packer, 'other')).toBe(true);
  });

  it('lets members edit their own or created tasks only', () => {
    const mine = { assigneeId: 'me', createdById: 'boss' };
    const created = { assigneeId: 'other', createdById: 'me' };
    const foreign = { assigneeId: 'x', createdById: 'y' };
    expect(canEditTask(member, mine)).toBe(true);
    expect(canEditTask(member, created)).toBe(true);
    expect(canEditTask(member, foreign)).toBe(false);
    expect(canEditTask(admin, foreign)).toBe(true);
    expect(canDeleteTask(member, created)).toBe(false);
    expect(canDeleteTask(member, { assigneeId: 'me', createdById: 'me' })).toBe(
      true,
    );
  });

  it('normalizes instagram handles, dm keys, and role names', () => {
    expect(normalizeInstagram('@Stiff_Lab')).toBe('stiff_lab');
    expect(dmKeyFor('b', 'a')).toBe('a:b');
    expect(slugifyRoleName(' Packing Lead ')).toBe('packing_lead');
  });
});
