import { BadRequestException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { VariantsService } from './variants.service';

/**
 * `decrement` is the shop's oversell guard: the `stock >= $2` in its WHERE
 * clause is what stops two checkouts racing for the last unit from both
 * succeeding. Everything here exists to prove the guard is actually read.
 *
 * The manager is faked rather than mocked against a database because the thing
 * under test is not the SQL — Postgres is trusted to apply a WHERE clause. It
 * is what the service concludes from the *shape* the driver hands back, which
 * is where this went wrong.
 */
function managerReturning(result: unknown): EntityManager {
  return {
    query: jest.fn().mockResolvedValue(result),
  } as unknown as EntityManager;
}

describe('VariantsService.decrement', () => {
  const service = new VariantsService(null as never);

  /**
   * TypeORM's Postgres driver returns `[rows, rowCount]` for UPDATE and
   * DELETE. When the guard holds nothing back, `rows` carries the RETURNING
   * row.
   */
  it('accepts a decrement that moved a row', async () => {
    const manager = managerReturning([[{ id: 'variant-1' }], 1]);
    await expect(
      service.decrement(manager, 'variant-1', 2, 'Tee (Black, M)'),
    ).resolves.toBeUndefined();
  });

  /**
   * The regression this file exists for.
   *
   * A short-stocked or retired variant matches no row, so the driver returns
   * `[[], 0]` — still a two-element array. Testing `result.length === 0` asked
   * "did the driver return the pair?" (always yes) instead of "did the WHERE
   * clause hold?", so the guard never fired and checkout carried on to write
   * an order for stock the shop did not have.
   */
  it('refuses a decrement that moved no row', async () => {
    const manager = managerReturning([[], 0]);
    await expect(
      service.decrement(manager, 'variant-1', 2, 'Tee (Black, M)'),
    ).rejects.toThrow(BadRequestException);
  });

  it('names the line in the message, so the shopper knows which one to change', async () => {
    const manager = managerReturning([[], 0]);
    await expect(
      service.decrement(manager, 'variant-1', 2, 'Tee (Black, M)'),
    ).rejects.toThrow('Not enough stock for Tee (Black, M)');
  });

  /**
   * Not the shape this driver sends, but the one a bare row array would take.
   * Pinned so swapping drivers, or a future `useStructuredResult`, fails loudly
   * here rather than silently reopening the oversell hole.
   */
  it('reads a plain row array too', async () => {
    await expect(
      service.decrement(managerReturning([{ id: 'v' }]), 'v', 1, 'Tee'),
    ).resolves.toBeUndefined();
    await expect(
      service.decrement(managerReturning([]), 'v', 1, 'Tee'),
    ).rejects.toThrow(BadRequestException);
  });

  /** A driver that returns nothing usable must fail closed, never open. */
  it('fails closed on an unrecognised result', async () => {
    await expect(
      service.decrement(managerReturning(undefined), 'v', 1, 'Tee'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.decrement(managerReturning(null), 'v', 1, 'Tee'),
    ).rejects.toThrow(BadRequestException);
  });
});
