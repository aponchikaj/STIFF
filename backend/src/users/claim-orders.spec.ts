import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { RefreshToken } from '../auth/refresh-token.entity';
import { Comment } from '../comments/comment.entity';
import { Order } from '../orders/order.entity';
import { Reaction } from '../reactions/reaction.entity';
import { User } from './user.entity';
import { UsersService } from './users.service';

/**
 * A guest order carries a full name, a street address, a phone number and a
 * payment history. Handing that to whoever types the address into a signup
 * form would be a serious breach, so the gate — a *verified* email — is the
 * part worth pinning down.
 */
describe('UsersService.claimGuestOrders', () => {
  let service: UsersService;
  let execute: jest.Mock;
  let builder: Record<string, jest.Mock>;

  beforeEach(async () => {
    execute = jest.fn().mockResolvedValue({ affected: 2 });
    builder = {
      update: jest.fn(() => builder),
      set: jest.fn(() => builder),
      where: jest.fn(() => builder),
      andWhere: jest.fn(() => builder),
      execute,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(Order),
          useValue: { createQueryBuilder: jest.fn(() => builder) },
        },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(Comment), useValue: {} },
        { provide: getRepositoryToken(Reaction), useValue: {} },
        { provide: getRepositoryToken(RefreshToken), useValue: {} },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  const account = (over: Partial<User> = {}): User =>
    ({
      id: 'user-1',
      email: 'sam@example.com',
      isVerified: true,
      ...over,
    }) as User;

  it('refuses to claim anything for an unverified account', async () => {
    // Registering with an address is not proof of owning it. Without this,
    // anyone could type a stranger's email into signup and read their
    // delivery address.
    const claimed = await service.claimGuestOrders(
      account({ isVerified: false }),
    );
    expect(claimed).toBe(0);
    expect(execute).not.toHaveBeenCalled();
  });

  it('claims for a verified account and reports how many moved', async () => {
    expect(await service.claimGuestOrders(account())).toBe(2);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('only touches orders nobody owns yet', async () => {
    await service.claimGuestOrders(account());
    expect(builder.where).toHaveBeenCalledWith('"userId" IS NULL');
  });

  it('matches the email case-insensitively', async () => {
    // Sam@X.com at checkout and sam@x.com at signup are the same inbox.
    await service.claimGuestOrders(account());
    expect(builder.andWhere).toHaveBeenCalledWith(
      'lower("guestEmail") = lower(:email)',
      { email: 'sam@example.com' },
    );
  });

  it('stamps claimedAt, so a transfer is distinguishable afterwards', async () => {
    await service.claimGuestOrders(account());
    const [payload] = builder.set.mock.calls[0] as [Record<string, unknown>];
    expect(payload.userId).toBe('user-1');
    expect(payload.claimedAt).toBeDefined();
  });

  it('reports zero rather than undefined when nothing matched', async () => {
    execute.mockResolvedValue({ affected: 0 });
    expect(await service.claimGuestOrders(account())).toBe(0);
    execute.mockResolvedValue({});
    expect(await service.claimGuestOrders(account())).toBe(0);
  });
});
