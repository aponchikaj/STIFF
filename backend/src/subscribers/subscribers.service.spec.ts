import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from '../mail/mail.service';
import { Subscriber } from './subscriber.entity';
import { SubscribersService } from './subscribers.service';

function subscriber(overrides: Partial<Subscriber> = {}): Subscriber {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'sam@example.com',
    status: 'pending',
    confirmToken: 'a'.repeat(48),
    confirmSentAt: new Date(),
    unsubscribeToken: 'b'.repeat(48),
    source: 'home',
    confirmedAt: null,
    unsubscribedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SubscribersService', () => {
  let service: SubscribersService;
  let repo: {
    createQueryBuilder: jest.Mock;
    create: jest.Mock;
    save: jest.Mock<Promise<Subscriber>, [Subscriber]>;
    findOne: jest.Mock;
    find: jest.Mock;
    delete: jest.Mock;
  };
  let sendConfirmation: jest.Mock;
  let existing: Subscriber | null;

  beforeEach(async () => {
    existing = null;
    sendConfirmation = jest.fn().mockResolvedValue(undefined);
    repo = {
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(() => Promise.resolve(existing)),
      })),
      create: jest.fn((row: Partial<Subscriber>) => row as Subscriber),
      save: jest.fn((row: Subscriber) => Promise.resolve(row)),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscribersService,
        { provide: getRepositoryToken(Subscriber), useValue: repo },
        {
          provide: MailService,
          useValue: { sendSubscribeConfirmation: sendConfirmation },
        },
      ],
    }).compile();

    service = module.get(SubscribersService);
  });

  describe('subscribe', () => {
    it('stores a pending row and sends exactly one confirmation', async () => {
      await service.subscribe('sam@example.com', 'home');

      const saved = repo.save.mock.calls[0][0];
      expect(saved.status).toBe('pending');
      expect(saved.confirmToken).toEqual(expect.any(String));
      expect(saved.unsubscribeToken).toEqual(expect.any(String));
      expect(sendConfirmation).toHaveBeenCalledTimes(1);
      expect(sendConfirmation).toHaveBeenCalledWith(
        'sam@example.com',
        saved.confirmToken,
      );
    });

    it('gives a new address two different tokens', async () => {
      // The confirm link is forwardable and the unsubscribe link is permanent.
      // One value doing both jobs means a forwarded confirmation can also
      // unsubscribe the person who sent it.
      await service.subscribe('sam@example.com', 'home');
      const saved = repo.save.mock.calls[0][0];
      expect(saved.confirmToken).not.toEqual(saved.unsubscribeToken);
    });

    it('never emails an address that has already confirmed', async () => {
      // The list is the asset. Re-confirming somebody who is already on it is
      // a mail nobody asked for, and a way to use the form as a mail cannon.
      existing = subscriber({ status: 'confirmed', confirmToken: null });

      await service.subscribe('sam@example.com', 'home');

      expect(sendConfirmation).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('refuses to re-send within the cooldown', async () => {
      existing = subscriber({ confirmSentAt: new Date() });

      await service.subscribe('sam@example.com', 'home');

      expect(sendConfirmation).not.toHaveBeenCalled();
    });

    it('re-sends once the cooldown has passed', async () => {
      existing = subscriber({
        confirmSentAt: new Date(Date.now() - 30 * 60 * 1000),
      });

      await service.subscribe('sam@example.com', 'home');

      expect(sendConfirmation).toHaveBeenCalledTimes(1);
      // A fresh token, so the abandoned link from the first attempt is dead.
      const saved = repo.save.mock.calls[0][0];
      expect(saved.confirmToken).not.toBe('a'.repeat(48));
    });

    it('lets somebody who left come back', async () => {
      existing = subscriber({
        status: 'unsubscribed',
        unsubscribedAt: new Date(),
        confirmSentAt: null,
        confirmToken: null,
      });

      await service.subscribe('sam@example.com', 'home');

      const saved = repo.save.mock.calls[0][0];
      expect(saved.status).toBe('pending');
      expect(saved.unsubscribedAt).toBeNull();
      // Still through the front door: a returning address is pending, not
      // confirmed, so it re-consents like anybody else.
      expect(sendConfirmation).toHaveBeenCalledTimes(1);
    });

    it('keeps the same unsubscribe token across a re-subscribe', async () => {
      existing = subscriber({ status: 'unsubscribed', confirmSentAt: null });

      await service.subscribe('sam@example.com', 'home');

      const saved = repo.save.mock.calls[0][0];
      expect(saved.unsubscribeToken).toBe('b'.repeat(48));
    });

    it('answers the same way whatever it found', async () => {
      // Otherwise the form is an oracle for "is this address on the list".
      const brandNew = await service.subscribe('new@example.com', 'home');
      existing = subscriber({ status: 'confirmed' });
      const known = await service.subscribe('sam@example.com', 'home');
      expect(brandNew).toEqual(known);
    });
  });

  describe('confirm', () => {
    it('confirms and burns the token', async () => {
      repo.findOne.mockResolvedValueOnce(subscriber());

      const result = await service.confirm('a'.repeat(48));

      const saved = repo.save.mock.calls[0][0];
      expect(saved.status).toBe('confirmed');
      expect(saved.confirmedAt).toEqual(expect.any(Date));
      // Cleared, so a forwarded link cannot be replayed.
      expect(saved.confirmToken).toBeNull();
      expect(result.alreadyDone).toBe(false);
    });

    it('rejects a token that has already been used', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(service.confirm('a'.repeat(48))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects a link older than the window', async () => {
      repo.findOne.mockResolvedValueOnce(
        subscriber({
          confirmSentAt: new Date(Date.now() - 30 * 86400_000),
        }),
      );
      await expect(service.confirm('a'.repeat(48))).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribe', () => {
    it('marks them gone without deleting the row', async () => {
      repo.findOne.mockResolvedValueOnce(subscriber({ status: 'confirmed' }));

      await service.unsubscribe('b'.repeat(48));

      const saved = repo.save.mock.calls[0][0];
      expect(saved.status).toBe('unsubscribed');
      expect(saved.unsubscribedAt).toEqual(expect.any(Date));
      // Kept on purpose: a deleted address is one we would happily email again
      // the next time somebody types it into the form.
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('is safe to click twice', async () => {
      const already = subscriber({
        status: 'unsubscribed',
        unsubscribedAt: new Date('2026-01-01'),
      });
      repo.findOne.mockResolvedValueOnce(already);

      await expect(service.unsubscribe('b'.repeat(48))).resolves.toEqual({
        email: 'sam@example.com',
      });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects an unknown token', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(service.unsubscribe('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
