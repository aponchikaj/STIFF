import { GoneException } from '@nestjs/common';
import type { User } from '../users/user.entity';
import { AssignmentsService } from './assignments.service';
import { ClansService } from './clans.service';
import { CLANS_ARCHIVED, CLANS_ARCHIVED_MESSAGE } from './rules';

/**
 * Clans are archived. Making one, joining one and drawing a team task are
 * refused with 410 Gone; leaving still works, so nobody is stuck in a clan.
 *
 * Built without dependencies on purpose: the archive check comes first, so a
 * refusal never reaches the database — and leaving, which does reach for a
 * dependency, proves it got past the check.
 */
describe('Clans — archived', () => {
  const user = { id: 'u1' } as User;
  const NOT_REACHED = new Error('reached a dependency');
  const reach = () => Promise.reject(NOT_REACHED);

  function clans(): ClansService {
    const s = Object.create(ClansService.prototype) as ClansService;
    Object.assign(s, {
      seasonsService: { requireCurrent: reach },
      enrolmentsService: { require: reach },
    });
    return s;
  }

  function assignments(): AssignmentsService {
    const s = Object.create(AssignmentsService.prototype) as AssignmentsService;
    Object.assign(s, {
      seasonsService: { requireCurrent: reach, startDue: reach },
      enrolmentsService: { require: reach },
    });
    return s;
  }

  it('is archived', () => {
    expect(CLANS_ARCHIVED).toBe(true);
  });

  it.each([
    ['create', () => clans().create(user, 'Night Shift')],
    ['join', () => clans().join(user, 'ABC123')],
    ['drawForClan', () => assignments().drawForClan(user, 1)],
  ])('refuses %s with 410 Gone', async (_name, call) => {
    await expect(call()).rejects.toBeInstanceOf(GoneException);
    await expect(call()).rejects.toThrow(CLANS_ARCHIVED_MESSAGE);
  });

  it('still lets a member leave', async () => {
    await expect(clans().leave(user)).rejects.not.toBeInstanceOf(GoneException);
  });
});
