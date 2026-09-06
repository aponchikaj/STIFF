import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { LessThan } from 'typeorm';
import { RefreshToken } from './refresh-token.entity';
import { TokenService } from './token.service';

/**
 * Token housekeeping, and the reason it is bounded by expiry rather than by
 * "this row looks used up".
 *
 * A revoked row is not spent — it *is* the reuse detector. `consumeRefreshToken`
 * reads `revokedAt` to tell a replayed token from an unknown one, and only the
 * replay case revokes the whole family. Sweeping revoked rows early turns a
 * detected theft into a plain "invalid token": the request still fails, so
 * nothing looks wrong, and the thief's other tokens keep working.
 */
describe('TokenService.purgeStale', () => {
  let service: TokenService;
  let repo: { delete: jest.Mock };

  beforeEach(async () => {
    repo = { delete: jest.fn().mockResolvedValue({ affected: 3 }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: getRepositoryToken(RefreshToken), useValue: repo },
      ],
    }).compile();

    service = module.get(TokenService);
  });

  it('drops rows whose token has expired', async () => {
    const purged = await service.purgeStale();
    expect(purged).toBe(3);
    expect(repo.delete).toHaveBeenCalledWith({
      expiresAt: expect.any(Object) as unknown,
    });
  });

  /**
   * The regression this file exists for. With a 30-day refresh TTL and a
   * 7-day revoked sweep, a token revoked on day one lost its row on day eight
   * and stayed replayable until day thirty — a three-week window in which
   * reuse detection silently did nothing.
   */
  it('does not sweep revoked rows while their token could still be replayed', async () => {
    await service.purgeStale();
    expect(repo.delete).toHaveBeenCalledTimes(1);
    const [criteria] = repo.delete.mock.calls[0] as [Record<string, unknown>];
    expect(criteria).not.toHaveProperty('revokedAt');
  });

  it('bounds the sweep at expiry, which is when replay stops being possible', async () => {
    const before = Date.now();
    await service.purgeStale();
    const [criteria] = repo.delete.mock.calls[0] as [
      { expiresAt: ReturnType<typeof LessThan> },
    ];
    const cutoff = (criteria.expiresAt as unknown as { value: Date }).value;
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('reports nothing purged rather than NaN when the driver says so', async () => {
    repo.delete.mockResolvedValue({ affected: null });
    await expect(service.purgeStale()).resolves.toBe(0);
  });
});
