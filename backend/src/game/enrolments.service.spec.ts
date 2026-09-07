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
  /** Only the settings column is touched, and only by raw jsonb merge. */
  let userRepo: { query: jest.Mock };

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

    userRepo = { query: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrolmentsService,
        { provide: getRepositoryToken(GameEnrolment), useValue: repo },
        { provide: getRepositoryToken(User), useValue: userRepo },
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

  /**
   * The front door: somebody picks a side before there is anything to join.
   *
   * The game's sign-up asks for a side *first* and an account second, so the
   * choice arrives at a moment when there may be no season at all. Refusing it
   * would make the only interesting question on the page a dead end.
   *
   * The distinction these hold: **an enrolment is irreversible, an intention is
   * not.** Once a season has taken someone as a player, that is fixed. Someone
   * who picked "watcher" in October has not joined anything, and locking them
   * out of playing in January would enforce a rule about a season that did not
   * exist when they chose.
   */
  describe('chooseRole', () => {
    it('enrols straight away when a season is open', async () => {
      const choice = await service.chooseRole(USER, 'player');
      expect(choice.pending).toBeNull();
      expect(choice.enrolment).toMatchObject({ role: 'player' });
      expect(repo.query).toHaveBeenCalled();
    });

    /** Nothing to join yet, so the choice is kept rather than refused. */
    it('remembers the side when there is no season', async () => {
      seasons.current.mockResolvedValue(null);

      const choice = await service.chooseRole(USER, 'player');

      expect(choice.pending).toBe('no_season');
      expect(choice.enrolment).toBeNull();
      expect(choice.role).toBe('player');
      expect(userRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('settings'),
        expect.arrayContaining([USER.id]),
      );
    });

    /** The qualifier was the door; the intent carries to the next season. */
    it('remembers the side when the season has already started', async () => {
      seasons.current.mockResolvedValue(season({ status: 'running' }));
      repo.findOne.mockResolvedValue(null);

      const choice = await service.chooseRole(USER, 'watcher');

      expect(choice.pending).toBe('enrolment_closed');
      expect(choice.enrolment).toBeNull();
      expect(userRepo.query).toHaveBeenCalled();
    });

    /** Already in and the season is running — answer with what they are. */
    it('answers an existing enrolment after the season starts', async () => {
      seasons.current.mockResolvedValue(season({ status: 'running' }));
      repo.findOne.mockResolvedValue({
        id: 'e1',
        role: 'player',
        handle: 'asterisk',
        heartsRemaining: 2,
        heartsTotal: 3,
        nerve: 40,
      });

      const choice = await service.chooseRole(USER, 'player');

      expect(choice.pending).toBeNull();
      expect(choice.enrolment).toMatchObject({ role: 'player', nerve: 40 });
    });

    /** The irreversible half. A real enrolment still cannot be swapped. */
    it('refuses to swap a side that a season already took', async () => {
      seasons.current.mockResolvedValue(season({ status: 'running' }));
      repo.findOne.mockResolvedValue({ id: 'e1', role: 'player' });

      await expect(service.chooseRole(USER, 'watcher')).rejects.toThrow(
        ConflictException,
      );
    });

    /**
     * The reversible half. Nothing has been joined, so changing your mind
     * before a season exists is not the rule this game enforces.
     */
    it('lets a remembered side be changed while no season exists', async () => {
      seasons.current.mockResolvedValue(null);

      await service.chooseRole(USER, 'watcher');
      const second = await service.chooseRole(USER, 'player');

      expect(second.role).toBe('player');
      expect(second.pending).toBe('no_season');
    });

    /** Once it is a real enrolment the note is spent, so it is dropped. */
    it('forgets the note once a season has taken them', async () => {
      // A note left behind would claim a side the enrolment already settled.
      const withNote = {
        ...USER,
        settings: { game: { role: 'player' } },
      } as unknown as User;

      await service.chooseRole(withNote, 'player');

      const statements = userRepo.query.mock.calls.map(
        (call) => (call as [string])[0],
      );
      expect(statements.join(' ')).toMatch(/- 'game'/);
    });

    it('still refuses a side that is neither', async () => {
      await expect(
        service.chooseRole(USER, 'referee' as never),
      ).rejects.toThrow(/player or watcher/);
    });
  });

  describe('rememberedRole', () => {
    it('reads back what was kept', () => {
      const user = {
        settings: { game: { role: 'player' } },
      } as unknown as User;
      expect(service.rememberedRole(user)).toBe('player');
    });

    it('is null when nothing was kept, or when it is nonsense', () => {
      expect(service.rememberedRole({ settings: {} } as User)).toBeNull();
      expect(service.rememberedRole({} as User)).toBeNull();
      expect(
        service.rememberedRole({
          settings: { game: { role: 'referee' } },
        } as unknown as User),
      ).toBeNull();
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
