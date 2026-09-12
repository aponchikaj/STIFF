import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { User } from '../users/user.entity';
import { ClansService, mintCode, normaliseName } from './clans.service';
import { GameClan, GameClanMember } from './entities/game-clan.entity';
import { EnrolmentsService } from './enrolments.service';
import { SeasonsService } from './seasons.service';

/**
 * Two players, one leader, one clan per person.
 *
 * The constraints are what hold the shape; what these prove is that the
 * service reads an empty `RETURNING` as the constraint refusing rather than
 * as success, and that every refusal reaches the person as the right message.
 */

const USER = { id: 'u1', username: 'asterisk' } as User;
const ENROLMENT = { id: 'e1', role: 'player', heartsRemaining: 3 };

function clan(overrides: Partial<GameClan> = {}): GameClan {
  return {
    id: 'c1',
    seasonId: 's1',
    name: 'Night Owls',
    nameKey: 'night owls',
    status: 'forming',
    inviteCode: 'ABCD2345',
    createdAt: new Date('2026-09-11T10:00:00.000Z'),
    ...overrides,
  } as GameClan;
}

function leaderSeat(overrides: Partial<GameClanMember> = {}): GameClanMember {
  return {
    id: 'm1',
    clanId: 'c1',
    enrolmentId: 'e1',
    role: 'leader',
    enrolment: { handle: 'asterisk', nerve: 4, coins: 2, heartsRemaining: 3 },
    ...overrides,
  } as GameClanMember;
}

function memberSeat(overrides: Partial<GameClanMember> = {}): GameClanMember {
  return {
    id: 'm2',
    clanId: 'c1',
    enrolmentId: 'e2',
    role: 'member',
    enrolment: { handle: 'kate', nerve: 1, coins: 0, heartsRemaining: 2 },
    ...overrides,
  } as GameClanMember;
}

describe('ClansService', () => {
  let service: ClansService;
  let clanRepo: { findOne: jest.Mock };
  let memberRepo: { findOne: jest.Mock; find: jest.Mock };
  let manager: { query: jest.Mock; delete: jest.Mock; update: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let enrolments: { require: jest.Mock };

  beforeEach(async () => {
    clanRepo = { findOne: jest.fn().mockResolvedValue(clan()) };
    memberRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([leaderSeat()]),
    };
    manager = {
      query: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: jest.fn((cb: (m: unknown) => Promise<unknown>) =>
        cb(manager),
      ),
    };
    enrolments = { require: jest.fn().mockResolvedValue(ENROLMENT) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClansService,
        { provide: getRepositoryToken(GameClan), useValue: clanRepo },
        { provide: getRepositoryToken(GameClanMember), useValue: memberRepo },
        { provide: DataSource, useValue: dataSource },
        {
          provide: SeasonsService,
          useValue: {
            requireCurrent: jest
              .fn()
              .mockResolvedValue({ id: 's1', status: 'running' }),
          },
        },
        { provide: EnrolmentsService, useValue: enrolments },
      ],
    }).compile();

    service = module.get(ClansService);
  });

  describe('normaliseName', () => {
    it('trims and collapses spaces', () => {
      expect(normaliseName('  Night   Owls  ')).toBe('Night Owls');
    });

    it('allows letters, digits, spaces, dots, dashes and underscores', () => {
      expect(normaliseName('Team_1.5-x')).toBe('Team_1.5-x');
    });

    it('allows Georgian letters', () => {
      expect(normaliseName('ბუები')).toBe('ბუები');
    });

    it('refuses fewer than three characters', () => {
      expect(() => normaliseName('ab')).toThrow(BadRequestException);
    });

    it('refuses more than twenty-four characters', () => {
      expect(() => normaliseName('a'.repeat(25))).toThrow(BadRequestException);
    });

    it('refuses punctuation outside the set', () => {
      expect(() => normaliseName('Owls!')).toThrow(BadRequestException);
      expect(() => normaliseName('<owls>')).toThrow(BadRequestException);
    });
  });

  describe('mintCode', () => {
    it('is eight characters with no look-alikes', () => {
      for (let i = 0; i < 50; i++) {
        const code = mintCode();
        expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
        expect(code).not.toMatch(/[0O1IL]/);
      }
    });
  });

  describe('create', () => {
    it('refuses someone already in a clan, before any insert', async () => {
      memberRepo.findOne.mockResolvedValue(leaderSeat());
      await expect(service.create(USER, 'Night Owls')).rejects.toThrow(
        ConflictException,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('asks for a player enrolment', async () => {
      manager.query
        .mockResolvedValueOnce([{ id: 'c1' }])
        .mockResolvedValueOnce([{ id: 'm1' }]);
      await service.create(USER, 'Night Owls');
      expect(enrolments.require).toHaveBeenCalledWith(USER, 'player');
    });

    it('refuses a name another clan has this season', async () => {
      manager.query.mockResolvedValueOnce([]);
      await expect(service.create(USER, 'Night Owls')).rejects.toThrow(
        /already has that name/,
      );
    });

    it('refuses when the seat insert declines', async () => {
      manager.query
        .mockResolvedValueOnce([{ id: 'c1' }])
        .mockResolvedValueOnce([]);
      await expect(service.create(USER, 'Night Owls')).rejects.toThrow(
        /already in a clan/,
      );
    });

    it('seats the caller as leader with the unique on the enrolment deciding', async () => {
      manager.query
        .mockResolvedValueOnce([{ id: 'c1' }])
        .mockResolvedValueOnce([{ id: 'm1' }]);
      await service.create(USER, 'Night Owls');

      const [clanSql, clanParams] = manager.query.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(clanSql).toContain(
        `ON CONFLICT ("seasonId", "nameKey") DO NOTHING`,
      );
      expect(clanParams.slice(0, 3)).toEqual([
        's1',
        'Night Owls',
        'night owls',
      ]);
      expect(clanParams[3]).toMatch(/^[A-Z2-9]{8}$/);

      const [seatSql, seatParams] = manager.query.mock.calls[1] as [
        string,
        unknown[],
      ];
      expect(seatSql).toContain(`'leader'`);
      expect(seatSql).toContain(`ON CONFLICT ("enrolmentId") DO NOTHING`);
      expect(seatParams).toEqual(['c1', 'e1']);
    });

    it('returns the forming clan with the invite code, to its leader', async () => {
      manager.query
        .mockResolvedValueOnce([{ id: 'c1' }])
        .mockResolvedValueOnce([{ id: 'm1' }]);
      const view = await service.create(USER, 'Night Owls');
      expect(view).toMatchObject({
        id: 'c1',
        name: 'Night Owls',
        status: 'forming',
        size: 2,
        inviteCode: 'ABCD2345',
        myRole: 'leader',
      });
      expect(view.members).toHaveLength(1);
      expect(view.members[0]).toMatchObject({
        enrolmentId: 'e1',
        handle: 'asterisk',
        role: 'leader',
        coins: 2,
      });
    });
  });

  describe('join', () => {
    it('refuses someone already in a clan', async () => {
      memberRepo.findOne.mockResolvedValue(memberSeat());
      await expect(service.join(USER, 'ABCD2345')).rejects.toThrow(
        ConflictException,
      );
      expect(clanRepo.findOne).not.toHaveBeenCalled();
    });

    it('404s an unknown code', async () => {
      clanRepo.findOne.mockResolvedValue(null);
      await expect(service.join(USER, 'ZZZZZZZZ')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('looks the code up upper-cased and trimmed, within the season', async () => {
      clanRepo.findOne.mockResolvedValue(null);
      await service.join(USER, '  abcd2345 ').catch(() => undefined);
      expect(clanRepo.findOne).toHaveBeenCalledWith({
        where: { inviteCode: 'ABCD2345', seasonId: 's1' },
      });
    });

    it('refuses a full clan', async () => {
      clanRepo.findOne.mockResolvedValue(clan({ status: 'full' }));
      await expect(service.join(USER, 'ABCD2345')).rejects.toThrow(
        /already full/,
      );
    });

    it('refuses a disbanded clan', async () => {
      clanRepo.findOne.mockResolvedValue(clan({ status: 'disbanded' }));
      await expect(service.join(USER, 'ABCD2345')).rejects.toThrow(/disbanded/);
    });

    it('refuses when the member seat is already taken', async () => {
      manager.query.mockResolvedValueOnce([]);
      await expect(service.join(USER, 'ABCD2345')).rejects.toThrow(
        ConflictException,
      );
      // No status flip for a seat that was not taken.
      expect(manager.query).toHaveBeenCalledTimes(1);
    });

    it('takes the member seat and fills the clan, guarded on forming', async () => {
      manager.query
        .mockResolvedValueOnce([{ id: 'm2' }])
        .mockResolvedValueOnce([]);
      memberRepo.find.mockResolvedValue([leaderSeat(), memberSeat()]);
      clanRepo.findOne
        .mockResolvedValueOnce(clan())
        .mockResolvedValueOnce(clan({ status: 'full' }));
      enrolments.require.mockResolvedValue({ id: 'e2', role: 'player' });

      const view = await service.join(USER, 'ABCD2345');

      const [seatSql, seatParams] = manager.query.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(seatSql).toContain(`'member'`);
      expect(seatParams).toEqual(['c1', 'e2']);
      const [flipSql, flipParams] = manager.query.mock.calls[1] as [
        string,
        unknown[],
      ];
      expect(flipSql).toContain(`SET "status" = 'full'`);
      expect(flipSql).toContain(`"status" = 'forming'`);
      expect(flipParams).toEqual(['c1']);

      expect(view.status).toBe('full');
      expect(view.members.map((m) => m.role)).toEqual(['leader', 'member']);
      expect(view.myRole).toBe('member');
      // The code has done its job; a full clan does not hand it out.
      expect(view.inviteCode).toBeNull();
    });
  });

  describe('mine', () => {
    it('is null for someone in no clan', async () => {
      expect(await service.mine(USER)).toBeNull();
    });

    it('works for a watcher too — any enrolment, not only a player', async () => {
      await service.mine(USER);
      expect(enrolments.require).toHaveBeenCalledWith(USER);
    });

    it('returns the clan with the reader’s role', async () => {
      memberRepo.findOne.mockResolvedValue(leaderSeat());
      const view = await service.mine(USER);
      expect(view).toMatchObject({ id: 'c1', myRole: 'leader' });
    });
  });

  describe('leave', () => {
    it('404s for someone in no clan', async () => {
      await expect(service.leave(USER)).rejects.toThrow(NotFoundException);
    });

    it('refuses to leave a full clan', async () => {
      memberRepo.findOne.mockResolvedValue(memberSeat());
      clanRepo.findOne.mockResolvedValue(clan({ status: 'full' }));
      await expect(service.leave(USER)).rejects.toThrow(/cannot be left/);
      expect(manager.delete).not.toHaveBeenCalled();
    });

    it('frees the member seat and keeps the clan', async () => {
      memberRepo.findOne.mockResolvedValue(memberSeat());
      const result = await service.leave(USER);
      expect(manager.delete).toHaveBeenCalledWith(GameClanMember, { id: 'm2' });
      expect(manager.update).not.toHaveBeenCalled();
      expect(result).toEqual({ left: true, disbanded: false });
    });

    it('disbands the clan when the leader leaves', async () => {
      memberRepo.findOne.mockResolvedValue(leaderSeat());
      const result = await service.leave(USER);
      expect(manager.delete).toHaveBeenCalledWith(GameClanMember, { id: 'm1' });
      expect(manager.update).toHaveBeenCalledWith(
        GameClan,
        { id: 'c1' },
        { status: 'disbanded' },
      );
      expect(result).toEqual({ left: true, disbanded: true });
    });
  });

  describe('requireLeader', () => {
    it('404s for someone in no clan', async () => {
      await expect(service.requireLeader('e1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses the member', async () => {
      memberRepo.findOne.mockResolvedValue(memberSeat());
      await expect(service.requireLeader('e2')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.requireLeader('e2')).rejects.toThrow(
        /Only the clan leader/,
      );
    });

    it('refuses a clan still waiting for its second person', async () => {
      memberRepo.findOne.mockResolvedValue(leaderSeat());
      await expect(service.requireLeader('e1')).rejects.toThrow(
        /second person/,
      );
    });

    it('refuses a clan marked full that has lost its member seat', async () => {
      memberRepo.findOne.mockResolvedValue(leaderSeat());
      clanRepo.findOne.mockResolvedValue(clan({ status: 'full' }));
      memberRepo.find.mockResolvedValue([leaderSeat()]);
      await expect(service.requireLeader('e1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('hands back both seats of a full clan', async () => {
      memberRepo.findOne.mockResolvedValue(leaderSeat());
      clanRepo.findOne.mockResolvedValue(clan({ status: 'full' }));
      memberRepo.find.mockResolvedValue([leaderSeat(), memberSeat()]);
      const seats = await service.requireLeader('e1');
      expect(seats.clan.id).toBe('c1');
      expect(seats.leader.enrolmentId).toBe('e1');
      expect(seats.member?.enrolmentId).toBe('e2');
      expect(seats.enrolmentIds).toEqual(['e1', 'e2']);
    });
  });

  describe('membership reads', () => {
    it('isMember asks by clan and enrolment', async () => {
      memberRepo.findOne.mockResolvedValue({ id: 'm2' });
      expect(await service.isMember('c1', 'e2')).toBe(true);
      expect(memberRepo.findOne).toHaveBeenCalledWith({
        where: { clanId: 'c1', enrolmentId: 'e2' },
        select: { id: true },
      });
      memberRepo.findOne.mockResolvedValue(null);
      expect(await service.isMember('c1', 'e9')).toBe(false);
    });

    it('memberEnrolmentIds lists both', async () => {
      memberRepo.find.mockResolvedValue([
        { enrolmentId: 'e1' },
        { enrolmentId: 'e2' },
      ]);
      expect(await service.memberEnrolmentIds('c1')).toEqual(['e1', 'e2']);
    });

    it('seats 404s an unknown clan', async () => {
      clanRepo.findOne.mockResolvedValue(null);
      await expect(service.seats('nope')).rejects.toThrow(NotFoundException);
    });

    it('seats 404s a clan with no leader', async () => {
      memberRepo.find.mockResolvedValue([memberSeat()]);
      await expect(service.seats('c1')).rejects.toThrow(/no leader/);
    });
  });
});
