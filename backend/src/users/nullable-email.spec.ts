import { ConflictException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { RefreshToken } from '../auth/refresh-token.entity';
import { AuthService } from '../auth/auth.service';
import { EmailToken } from '../auth/email-token.entity';
import { Comment } from '../comments/comment.entity';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Order } from '../orders/order.entity';
import { Reaction } from '../reactions/reaction.entity';
import { User } from './user.entity';
import { UsersService } from './users.service';

/**
 * An account with no email.
 *
 * The game's front door makes one from a username, a password and a date of
 * birth, and nothing else. These pin what that account can and cannot do:
 * it exists, it can sign in, it is mailed nothing, and it can add an address
 * later — which is then unverified until proven, like any other.
 */
describe('an account with no email', () => {
  let users: UsersService;
  let userRepo: Record<string, jest.Mock>;
  let builder: Record<string, jest.Mock>;

  beforeEach(async () => {
    builder = {
      where: jest.fn(() => builder),
      andWhere: jest.fn(() => builder),
      addSelect: jest.fn(() => builder),
      getOne: jest.fn().mockResolvedValue(null),
    };
    userRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((u: unknown) => u),
      save: jest.fn((u: unknown) =>
        Promise.resolve({ id: 'u1', ...(u as object) }),
      ),
      createQueryBuilder: jest.fn(() => builder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Order), useValue: {} },
        { provide: getRepositoryToken(Comment), useValue: {} },
        { provide: getRepositoryToken(Reaction), useValue: {} },
        { provide: getRepositoryToken(RefreshToken), useValue: {} },
      ],
    }).compile();

    users = module.get(UsersService);
  });

  describe('createUser', () => {
    it('stores null, and never asks whether null is already in use', async () => {
      const user = await users.createUser({
        username: 'asterisk',
        password: 'correct horse',
        birthDate: '2008-01-01',
      });
      expect(user.email).toBeNull();
      expect(user.birthDate).toBe('2008-01-01');
      // The email-duplicate lookup is `findOne({ where: { email } })`; with
      // no email it must not run, or two such accounts would clash on null.
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('still refuses a taken username', async () => {
      builder.getOne.mockResolvedValue({ id: 'other' });
      await expect(
        users.createUser({ username: 'asterisk', password: 'correct horse' }),
      ).rejects.toThrow(ConflictException);
    });

    it('lowercases and checks an email when one is given', async () => {
      await users.createUser({
        username: 'asterisk',
        email: 'Sam@Example.com',
        password: 'correct horse',
      });
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'sam@example.com' },
      });
    });
  });

  describe('updateProfile', () => {
    const account = (): User =>
      ({
        id: 'u1',
        username: 'asterisk',
        email: null,
        isVerified: false,
      }) as User;

    it('lets the account add an address, unverified', async () => {
      const user = account();
      const result = await users.updateProfile(user, {
        email: 'Sam@Example.com',
      });
      expect(result.email).toBe('sam@example.com');
      expect(user.isVerified).toBe(false);
      expect(userRepo.save).toHaveBeenCalled();
    });

    /** A verified account that changes its address has proven nothing about the new one. */
    it('drops verification when an existing address changes', async () => {
      const user = {
        ...account(),
        email: 'old@example.com',
        isVerified: true,
      } as User;
      await users.updateProfile(user, { email: 'new@example.com' });
      expect(user.isVerified).toBe(false);
    });

    it('keeps verification when the same address is sent back', async () => {
      const user = {
        ...account(),
        email: 'same@example.com',
        isVerified: true,
      } as User;
      await users.updateProfile(user, { email: 'SAME@example.com' });
      expect(user.isVerified).toBe(true);
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('refuses an address another account holds', async () => {
      builder.getOne.mockResolvedValue({ id: 'other' });
      await expect(
        users.updateProfile(account(), { email: 'taken@example.com' }),
      ).rejects.toThrow('Email already in use');
    });
  });
});

describe('AuthService with an email-less account', () => {
  let auth: AuthService;
  let usersService: { createUser: jest.Mock; findByEmail: jest.Mock };
  let mail: {
    sendVerificationEmail: jest.Mock;
    sendPasswordResetEmail: jest.Mock;
  };
  let tokens: { update: jest.Mock; save: jest.Mock; create: jest.Mock };

  beforeEach(async () => {
    usersService = {
      createUser: jest.fn((data: { email?: string | null }) =>
        Promise.resolve({
          id: 'u1',
          email: data.email ?? null,
          isVerified: false,
        }),
      ),
      findByEmail: jest.fn().mockResolvedValue(null),
    };
    mail = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };
    tokens = {
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((t: unknown) => t),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: MailService, useValue: mail },
        { provide: NotificationsService, useValue: { notify: jest.fn() } },
        { provide: getRepositoryToken(EmailToken), useValue: tokens },
      ],
    }).compile();

    auth = module.get(AuthService);
  });

  it('registers without an email and sends no verification mail', async () => {
    const user = await auth.register({
      username: 'asterisk',
      password: 'correct horse',
      birthDate: '2008-01-01',
    });
    expect(user.email).toBeNull();
    expect(usersService.createUser).toHaveBeenCalledWith({
      username: 'asterisk',
      email: null,
      password: 'correct horse',
      birthDate: '2008-01-01',
    });
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
    expect(tokens.save).not.toHaveBeenCalled();
  });

  it('still mails an account that gave an address', async () => {
    await auth.register({
      username: 'asterisk',
      email: 'sam@example.com',
      password: 'correct horse',
    });
    expect(mail.sendVerificationEmail).toHaveBeenCalledWith(
      'sam@example.com',
      expect.any(String),
    );
  });

  it('resend-verification is a no-op with nowhere to send', async () => {
    await auth.sendVerification({
      id: 'u1',
      email: null,
      isVerified: false,
    } as User);
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
  });
});
