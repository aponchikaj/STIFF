import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../users/user.entity';
import { GameEnrolment } from './entities/game-enrolment.entity';
import { GameSeason } from './entities/game-season.entity';
import { EnrolmentsService } from './enrolments.service';
import { SeasonsService } from './seasons.service';

/**
 * Taking a side, and being held to it.
 *
 * The role is the one irreversible choice in the game, so these are the rules
 * a person will argue with — and the argument should be settled here rather
 * than in whatever the service happened to do.
 */

const USER = { id: 'u1', username: 'asterisk' } as User;

function season(overrides: Partial<GameSeason> = {}): GameSeason {
  return {
    id: 's1',
    slug: 'season-zero',
    title: 'Season Zero',
    status: 'open',
    startingHearts: 3,
    ...overrides,
  } as GameSeason;
}

describe('EnrolmentsService', () => {
  let service: EnrolmentsService;
  let repo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    query: jest.Mock;
  };
  let seasons: { current: jest.Mock; requireCurrent: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((e: unknown) =>
        Promise.resolve({ id: 'e1', ...(e as object) }),
      ),
      create: jest.fn((e: unknown) => e),
      // Joining is one conditional upsert. Echoing the bound parameters back
      // keeps the hearts and handle assertions testing the real code path
      // rather than a fixture someone typed the expected answer into.
      query: jest.fn((_sql: string, params: unknown[]) =>
        Promise.resolve([
          {
            id: 'e1',
            seasonId: params[0],
            userId: params[1],
            role: params[2],
            handle: params[3],
            heartsRemaining: params[4],
            heartsTotal: params[4],
            nerve: 0,
          },
        ]),
      ),
    };
    seasons = {
      current: jest.fn().mockResolvedValue(season()),
      requireCurrent: jest.fn().mockResolvedValue(season()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrolmentsService,
        { provide: getRepositoryToken(GameEnrolment), useValue: repo },
        { provide: SeasonsService, useValue: seasons },
      ],
    }).compile();

    service = module.get(EnrolmentsService);
  });

  describe('enrol', () => {
    it('takes a player in with the season’s hearts', async () => {
      const result = await service.enrol(USER, 'player');
      expect(result.role).toBe('player');
      expect(result).toMatchObject({ heartsRemaining: 3, heartsTotal: 3 });
    });

    /**
     * Hearts are the player's stake. Giving a watcher three would put a number
     * on their profile that can never move and never means anything.
     */
    it('takes a watcher in with no hearts', async () => {
      const result = await service.enrol(USER, 'watcher');
      expect(result.role).toBe('watcher');
      expect(result).toMatchObject({ heartsRemaining: 0, heartsTotal: 0 });
    });

    it('starts everyone on no Nerve', async () => {
      expect((await service.enrol(USER, 'player')).nerve).toBe(0);
    });

    it('snapshots the handle off the account', async () => {
      expect((await service.enrol(USER, 'player')).handle).toBe('asterisk');
    });

    /**
     * A double-tapped button is not an error — and the double tap is exactly
     * what breaks a read-then-write. Both calls would find nothing, both would
     * insert, and the second would hit `UQ_game_enrolments_season_user` as an
     * unhandled driver error. The claim is one statement so the database
     * settles it instead.
     */
    it('is idempotent when asked again for the same side', async () => {
      repo.query.mockResolvedValue([
        {
          id: 'e1',
          role: 'player',
          handle: 'asterisk',
          heartsRemaining: 2,
          heartsTotal: 3,
          nerve: 40,
        },
      ]);

      const result = await service.enrol(USER, 'player');

      expect(result.nerve).toBe(40);
      expect(repo.query).toHaveBeenCalledTimes(1);
      // Nothing was read to decide it, so nothing read could be stale.
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('claims the place in a single conditional statement', async () => {
      await service.enrol(USER, 'player');
      const [sql] = repo.query.mock.calls[0] as [string];
      expect(sql).toMatch(/ON CONFLICT \("seasonId", "userId"\) DO UPDATE/);
      // The WHERE is what refuses a swapped side.
      expect(sql).toMatch(/WHERE "game_enrolments"\."role" = EXCLUDED\."role"/);
    });

    /**
     * The rule the whole entity exists for. A player who switched to watcher
     * after a bad day would be voting on the field they just left.
     */
    it('refuses to change a role once it is chosen', async () => {
      // The upsert's WHERE did not match, so it returned nothing — and that
      // silence is what the read below turns into the real message.
      repo.query.mockResolvedValue([]);
      repo.findOne.mockResolvedValue({ id: 'e1', role: 'player' });
      await expect(service.enrol(USER, 'watcher')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.enrol(USER, 'watcher')).rejects.toThrow(
        /already a player/,
      );
    });

    it('refuses an unknown side', async () => {
      await expect(service.enrol(USER, 'referee' as never)).rejects.toThrow(
        /player or watcher/,
      );
    });

    /** Enrolment closes when the ladder starts; the qualifier is the door. */
    it('refuses a newcomer once the season is running', async () => {
      seasons.requireCurrent.mockResolvedValue(season({ status: 'running' }));
      await expect(service.enrol(USER, 'player')).rejects.toThrow(
        /already started/,
      );
      // A shut season is not written to at all, not written and rolled back.
      expect(repo.query).not.toHaveBeenCalled();
    });

    /** Someone already in keeps their place when the season starts. */
    it('still answers an existing enrolment after the season starts', async () => {
      seasons.requireCurrent.mockResolvedValue(season({ status: 'running' }));
      repo.findOne.mockResolvedValue({
        id: 'e1',
        role: 'player',
        handle: 'asterisk',
        heartsRemaining: 3,
        heartsTotal: 3,
        nerve: 0,
      });
      await expect(service.enrol(USER, 'player')).resolves.toMatchObject({
        role: 'player',
      });
    });
  });

  describe('mine', () => {
    it('is null between seasons rather than an error', async () => {
      seasons.current.mockResolvedValue(null);
      await expect(service.mine(USER)).resolves.toBeNull();
    });

    it('is null for someone who never joined', async () => {
      await expect(service.mine(USER)).resolves.toBeNull();
    });
  });

  describe('require', () => {
    it('refuses someone who never joined', async () => {
      await expect(service.require(USER)).rejects.toThrow(NotFoundException);
    });

    it('lets a player through a player route', async () => {
      repo.findOne.mockResolvedValue({ id: 'e1', role: 'player' });
      await expect(service.require(USER, 'player')).resolves.toMatchObject({
        id: 'e1',
      });
    });

    /** A watcher cannot hand anything in — this is what enforces that. */
    it('refuses a watcher on a player route, and says why', async () => {
      repo.findOne.mockResolvedValue({ id: 'e1', role: 'watcher' });
      await expect(service.require(USER, 'player')).rejects.toThrow(
        /joined this season as a watcher/,
      );
    });

    it('refuses a player on a watcher route', async () => {
      repo.findOne.mockResolvedValue({ id: 'e1', role: 'player' });
      await expect(service.require(USER, 'watcher')).rejects.toThrow(
        ConflictException,
      );
    });

    it('does not care about the role when none is asked for', async () => {
      repo.findOne.mockResolvedValue({ id: 'e1', role: 'watcher' });
      await expect(service.require(USER)).resolves.toMatchObject({ id: 'e1' });
    });
  });
});
