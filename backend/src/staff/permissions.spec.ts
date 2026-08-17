import {
  canAssignRole,
  canAssignTaskTo,
  canBlockUser,
  canCreateRole,
  canDeleteTask,
  canEditTask,
  dmKeyFor,
  isManager,
  normalizeInstagram,
} from './permissions';

describe('staff permissions', () => {
  it('lets only owners mint other owners and admins', () => {
    expect(canCreateRole('owner', 'owner')).toBe(true);
    expect(canCreateRole('owner', 'admin')).toBe(true);
    expect(canCreateRole('owner', 'member')).toBe(true);
    expect(canCreateRole('admin', 'member')).toBe(true);
    expect(canCreateRole('admin', 'admin')).toBe(false);
    expect(canCreateRole('admin', 'owner')).toBe(false);
    expect(canCreateRole('member', 'member')).toBe(false);
  });

  it('lets only owners change roles', () => {
    expect(canAssignRole('owner')).toBe(true);
    expect(canAssignRole('admin')).toBe(false);
    expect(canAssignRole('member')).toBe(false);
  });

  it('blocks the right people and never yourself', () => {
    expect(canBlockUser('owner', 'admin', 'a', 'b')).toBe(true);
    expect(canBlockUser('owner', 'owner', 'a', 'a')).toBe(false);
    expect(canBlockUser('admin', 'member', 'a', 'b')).toBe(true);
    expect(canBlockUser('admin', 'owner', 'a', 'b')).toBe(false);
    expect(canBlockUser('member', 'member', 'a', 'b')).toBe(false);
  });

  it('keeps members on their own task board', () => {
    expect(canAssignTaskTo('member', 'me', 'me')).toBe(true);
    expect(canAssignTaskTo('member', 'me', 'other')).toBe(false);
    expect(canAssignTaskTo('admin', 'me', 'other')).toBe(true);
    expect(isManager('owner')).toBe(true);
    expect(isManager('member')).toBe(false);
  });

  it('lets members edit their own or created tasks only', () => {
    const mine = { assigneeId: 'me', createdById: 'boss' };
    const created = { assigneeId: 'other', createdById: 'me' };
    const foreign = { assigneeId: 'x', createdById: 'y' };
    expect(canEditTask('member', 'me', mine)).toBe(true);
    expect(canEditTask('member', 'me', created)).toBe(true);
    expect(canEditTask('member', 'me', foreign)).toBe(false);
    expect(canEditTask('admin', 'me', foreign)).toBe(true);
    expect(canDeleteTask('member', 'me', created)).toBe(false);
    expect(
      canDeleteTask('member', 'me', { assigneeId: 'me', createdById: 'me' }),
    ).toBe(true);
  });

  it('normalizes instagram handles and dm keys', () => {
    expect(normalizeInstagram('@Stiff_Lab')).toBe('stiff_lab');
    expect(dmKeyFor('b', 'a')).toBe('a:b');
    expect(dmKeyFor('a', 'b')).toBe('a:b');
  });
});
