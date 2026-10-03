import { GoneException } from '@nestjs/common';
import type { User } from '../users/user.entity';
import { CLAN_WARS_ARCHIVED, WARS_ARCHIVED_MESSAGE } from './rules';
import { WarsService } from './wars.service';

/**
 * Clan wars are archived. Every way *into* a war is refused with 410 Gone;
 * every way *out* still runs, so a leftover war can be finished and its
 * stakes paid or refunded.
 *
 * The service is built without its dependencies on purpose: the archive
 * check is the first thing each entry point does, so a refusal never
 * reaches the database — and an exit that does reach for a dependency
 * proves it got past the check.
 */
describe('WarsService — archived', () => {
  const user = { id: 'u1' } as User;
  const NOT_REACHED = new Error('reached a dependency');

  function service(): WarsService {
    const s = Object.create(WarsService.prototype) as WarsService;
    const reach = () => Promise.reject(NOT_REACHED);
    Object.assign(s, {
      enrolments: { require: reach },
      seasons: { requireCurrent: reach },
      warRepo: { findOne: reach },
      dataSource: { transaction: reach },
    });
    return s;
  }

  it('is archived', () => {
    expect(CLAN_WARS_ARCHIVED).toBe(true);
  });

  it.each([
    ['propose', (s: WarsService) => s.propose(user, { opponentClanId: 'c2' })],
    ['accept', (s: WarsService) => s.accept(user, 'w1')],
    [
      'organize',
      (s: WarsService) =>
        s.organize({ challengerClanId: 'c1', opponentClanId: 'c2' }),
    ],
    [
      'placeBet',
      (s: WarsService) =>
        s.placeBet(user, 'w1', { side: 'challenger', coins: 5 }),
    ],
  ])('refuses %s with 410 Gone', async (_name, call) => {
    const attempt = call(service());
    await expect(attempt).rejects.toBeInstanceOf(GoneException);
    await expect(call(service())).rejects.toThrow(WARS_ARCHIVED_MESSAGE);
  });

  it.each([
    ['decline', (s: WarsService) => s.decline(user, 'w1')],
    ['withdraw', (s: WarsService) => s.withdraw(user, 'w1')],
    ['settle', (s: WarsService) => s.settle('w1', { force: true })],
    ['voidWar', (s: WarsService) => s.voidWar('w1', 'archived')],
  ])('still lets %s through, to unwind a leftover war', async (_name, call) => {
    await expect(call(service())).rejects.not.toBeInstanceOf(GoneException);
  });
});
