import { ConflictException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../users/user.entity';
import { CheatDetectorService } from './ai/cheat-detector.service';
import { AssignmentsService } from './assignments.service';
import { AttemptsService } from './attempts.service';
import { GameAttempt } from './entities/game-attempt.entity';
import { EnrolmentsService } from './enrolments.service';
import { MediaStorageService } from './media-storage.service';
import { SeasonsService } from './seasons.service';

/**
 * Handing in proof.
 *
 * There is no live streaming, so an attempt is a file: a still, or a clip
 * between five seconds and two minutes. The interesting property is that the
 * limits are checked **twice** — once to decide whether to spend an upload URL
 * on a client's claim, and once when the client comes back and says it is
 * done. Only the second one is a guarantee.
 *
 * There is no cap on hand-ins per day and there is a floor of four, so opening
 * an attempt is a plain insert — nothing to reserve, nothing to conflict with.
 *
 * Every hand-in is against an accepted task with time left on its clock. The
 * day and the task come from the assignment, never from the client, and the
 * confirm is where the clock is judged.
 */

const PLAYER = { id: 'u1', username: 'asterisk' } as User;

/** The accepted task the upload opens against. Day two, so it is not a default. */
const OPEN = {
  id: 'as1',
  day: 2,
  taskTemplateId: 't1',
  status: 'accepted',
  taskTemplate: { proof: 'either' },
};

function clip(overrides: Record<string, unknown> = {}) {
  return {
    assignmentId: 'as1',
    kind: 'video' as const,
    mimeType: 'video/mp4',
    byteSize: 6_000_000,
    durationSeconds: 42,
    ...overrides,
  };
}

describe('AttemptsService', () => {
  let service: AttemptsService;
  let repo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
    query: jest.Mock;
  };
  let assignments: {
    requireOpen: jest.Mock;
    closeWithAttempt: jest.Mock;
    expireOverdue: jest.Mock;
  };
  let enrolments: { require: jest.Mock };
  let cheatDetector: { inspectLater: jest.Mock };
  let storage: {
    mintObjectKey: jest.Mock;
    presignPut: jest.Mock;
    publicUrlFor: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((a: unknown) =>
        Promise.resolve({ id: 'a1', ...(a as object) }),
      ),
      create: jest.fn((a: unknown) => a),
      find: jest.fn().mockResolvedValue([]),
      // A plain INSERT ... RETURNING "id".
      query: jest.fn().mockResolvedValue([{ id: 'a1' }]),
    };
    assignments = {
      requireOpen: jest.fn().mockResolvedValue(OPEN),
      closeWithAttempt: jest.fn().mockResolvedValue(true),
      expireOverdue: jest.fn().mockResolvedValue({ expired: 0, burns: [] }),
    };
    enrolments = {
      require: jest.fn().mockResolvedValue({ id: 'e1', role: 'player' }),
    };
    cheatDetector = { inspectLater: jest.fn() };
    storage = {
      mintObjectKey: jest
        .fn()
        .mockReturnValue('seasons/zero/day-1/deadbeef.mp4'),
      presignPut: jest.fn().mockReturnValue({
        url: 'https://storage.example/put',
        objectKey: 'seasons/zero/day-1/deadbeef.mp4',
        expiresAt: new Date('2026-09-06T12:15:00.000Z'),
      }),
      publicUrlFor: jest
        .fn()
        .mockReturnValue(
          'https://media.stiff.ge/seasons/zero/day-1/deadbeef.mp4',
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttemptsService,
        { provide: getRepositoryToken(GameAttempt), useValue: repo },
        {
          provide: SeasonsService,
          useValue: {
            requireCurrent: jest
              .fn()
              .mockResolvedValue({ id: 's1', slug: 'season-zero' }),
          },
        },
        { provide: EnrolmentsService, useValue: enrolments },
        { provide: AssignmentsService, useValue: assignments },
        { provide: MediaStorageService, useValue: storage },
        { provide: CheatDetectorService, useValue: cheatDetector },
      ],
    }).compile();

    service = module.get(AttemptsService);
  });

  describe('requestUpload', () => {
    it('hands back a URL the browser can PUT to', async () => {
      const ticket = await service.requestUpload(PLAYER, clip());
      expect(ticket.uploadUrl).toBe('https://storage.example/put');
      expect(ticket.contentType).toBe('video/mp4');
      expect(ticket.attemptId).toBe('a1');
    });

    /** Only a player hands anything in. `require` is what says so. */
    it('asks for a player enrolment, not merely a session', async () => {
      await service.requestUpload(PLAYER, clip());
      expect(enrolments.require).toHaveBeenCalledWith(PLAYER, 'player');
    });

    it('opens the row before the file exists', async () => {
      await service.requestUpload(PLAYER, clip());
      const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/awaiting_upload/);
      expect(params).toContain('seasons/zero/day-1/deadbeef.mp4');
    });

    /**
     * Four a day is the floor, not the ceiling. Nothing is reserved per day,
     * so there is no conflict clause and no day to be "already handed in".
     */
    it('is a plain insert, with no per-day claim', async () => {
      await service.requestUpload(PLAYER, clip());
      expect(repo.query).toHaveBeenCalledTimes(1);
      const [sql] = repo.query.mock.calls[0] as [string];
      expect(sql).toMatch(/INSERT INTO "game_attempts"/);
      expect(sql).not.toMatch(/ON CONFLICT/);
      expect(sql).toMatch(/RETURNING "id"/);
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('lets a player open as many as they like on the same day', async () => {
      repo.query
        .mockResolvedValueOnce([{ id: 'a1' }])
        .mockResolvedValueOnce([{ id: 'a2' }]);
      const first = await service.requestUpload(PLAYER, clip());
      const second = await service.requestUpload(PLAYER, clip());
      expect(first.attemptId).toBe('a1');
      expect(second.attemptId).toBe('a2');
      expect(repo.query).toHaveBeenCalledTimes(2);
    });

    /** Every hand-in is against an accepted task with time left. */
    it('opens only against this player’s accepted, unexpired task', async () => {
      await service.requestUpload(PLAYER, clip());
      expect(assignments.requireOpen).toHaveBeenCalledWith('e1', 'as1');
    });

    /**
     * Offered, declined, expired, someone else's — `requireOpen` says which,
     * and nothing is minted for any of them.
     */
    it('refuses with what the task actually is, before spending a URL', async () => {
      assignments.requireOpen.mockRejectedValue(
        new ConflictException('Time ran out on that task.'),
      );
      await expect(service.requestUpload(PLAYER, clip())).rejects.toThrow(
        /Time ran out/,
      );
      expect(storage.mintObjectKey).not.toHaveBeenCalled();
      expect(storage.presignPut).not.toHaveBeenCalled();
      expect(repo.query).not.toHaveBeenCalled();
    });

    /**
     * The task says how it is proved, and the upload has to be that. A
     * "take a video" dare handed in as a still is not the dare.
     */
    describe('proof', () => {
      it('refuses a photo for a task that asks for a video, before spending a URL', async () => {
        assignments.requireOpen.mockResolvedValue({
          ...OPEN,
          taskTemplate: { proof: 'video' },
        });
        await expect(
          service.requestUpload(
            PLAYER,
            clip({
              kind: 'photo',
              mimeType: 'image/jpeg',
              durationSeconds: undefined,
            }),
          ),
        ).rejects.toThrow(/asks for a video/);
        expect(storage.mintObjectKey).not.toHaveBeenCalled();
        expect(repo.query).not.toHaveBeenCalled();
      });

      it('refuses a video for a task that asks for a photo', async () => {
        assignments.requireOpen.mockResolvedValue({
          ...OPEN,
          taskTemplate: { proof: 'photo' },
        });
        await expect(service.requestUpload(PLAYER, clip())).rejects.toThrow(
          /asks for a photo/,
        );
        expect(repo.query).not.toHaveBeenCalled();
      });

      it('accepts either kind for a task that leaves it to the player', async () => {
        assignments.requireOpen.mockResolvedValue({
          ...OPEN,
          taskTemplate: { proof: 'either' },
        });
        await service.requestUpload(PLAYER, clip());
        await service.requestUpload(
          PLAYER,
          clip({
            kind: 'photo',
            mimeType: 'image/jpeg',
            durationSeconds: undefined,
          }),
        );
        expect(repo.query).toHaveBeenCalledTimes(2);
      });

      it('treats a task with no template loaded as either', async () => {
        assignments.requireOpen.mockResolvedValue({
          ...OPEN,
          taskTemplate: undefined,
        });
        await service.requestUpload(
          PLAYER,
          clip({
            kind: 'photo',
            mimeType: 'image/jpeg',
            durationSeconds: undefined,
          }),
        );
        expect(repo.query).toHaveBeenCalledTimes(1);
      });
    });

    /** The client no longer says which day or which task; the assignment does. */
    it('takes the day and the task from the assignment, not the client', async () => {
      await service.requestUpload(PLAYER, clip());
      const [, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(params.slice(0, 5)).toEqual(['s1', 'e1', 't1', 'as1', 2]);
    });

    it('binds everything in the order the statement expects', async () => {
      await service.requestUpload(PLAYER, clip());
      const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/"taskTemplateId", "assignmentId", "day", "kind"/);
      expect(params).toEqual([
        's1',
        'e1',
        't1',
        'as1',
        2,
        'video',
        'seasons/zero/day-1/deadbeef.mp4',
        'video/mp4',
        6_000_000,
        42,
      ]);
    });

    /** The key is minted by the server; a filename cannot steer it. */
    it('never takes the object key from the client', async () => {
      await service.requestUpload(PLAYER, clip());
      expect(storage.mintObjectKey).toHaveBeenCalledWith(
        'season-zero',
        2,
        'mp4',
      );
    });

    it('refuses a clip under five seconds', async () => {
      await expect(
        service.requestUpload(PLAYER, clip({ durationSeconds: 4 })),
      ).rejects.toThrow(/at least 5 seconds/);
      expect(storage.presignPut).not.toHaveBeenCalled();
    });

    it('refuses a clip over two minutes', async () => {
      await expect(
        service.requestUpload(PLAYER, clip({ durationSeconds: 121 })),
      ).rejects.toThrow(/2 minutes or shorter/);
      expect(storage.presignPut).not.toHaveBeenCalled();
    });

    it('accepts a still with no duration at all', async () => {
      const ticket = await service.requestUpload(
        PLAYER,
        clip({
          kind: 'photo',
          mimeType: 'image/jpeg',
          byteSize: 400_000,
          durationSeconds: undefined,
        }),
      );
      expect(ticket.attemptId).toBe('a1');
      const [, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(params).toContain('photo');
      // A still carries no duration at all, which is also what
      // CHK_game_attempts_duration insists on.
      expect(params[params.length - 1]).toBeNull();
    });
  });

  describe('confirmUpload', () => {
    const reserved = {
      id: 'a1',
      enrolmentId: 'e1',
      assignmentId: 'as1',
      status: 'awaiting_upload',
      kind: 'video' as const,
      mimeType: 'video/mp4',
      objectKey: 'seasons/zero/day-1/deadbeef.mp4',
    };

    it('turns the reservation into a real attempt', async () => {
      repo.findOne.mockResolvedValue({ ...reserved });

      const result = await service.confirmUpload(PLAYER, 'a1', {
        byteSize: 6_000_000,
        durationSeconds: 42,
      });

      expect(result.status).toBe('submitted');
      expect(result.mediaUrl).toBe(
        'https://media.stiff.ge/seasons/zero/day-1/deadbeef.mp4',
      );
      expect(result.durationSeconds).toBe(42);
    });

    /** The confirm is the hand-in; this is the timestamp the sweep counts. */
    it('stamps submittedAt at the confirm', async () => {
      repo.findOne.mockResolvedValue({ ...reserved });
      const before = Date.now();
      const result = await service.confirmUpload(PLAYER, 'a1', {
        byteSize: 1,
        durationSeconds: 10,
      });
      expect(result.submittedAt).toBeInstanceOf(Date);
      expect((result.submittedAt as Date).getTime()).toBeGreaterThanOrEqual(
        before,
      );
    });

    /**
     * The cheat check starts after the save and off the request: the player
     * gets their 200 and the verdict lands on the row later. Nothing about
     * the confirm waits on a model.
     */
    it('hands the saved attempt to the cheat detector, and does not wait', async () => {
      repo.findOne.mockResolvedValue({ ...reserved });
      await service.confirmUpload(PLAYER, 'a1', {
        byteSize: 1,
        durationSeconds: 10,
      });
      expect(cheatDetector.inspectLater).toHaveBeenCalledWith('a1');
      // Called once the row is a real attempt, not before.
      const saveOrder = repo.save.mock.invocationCallOrder[0];
      const inspectOrder =
        cheatDetector.inspectLater.mock.invocationCallOrder[0];
      expect(inspectOrder).toBeGreaterThan(saveOrder);
    });

    /**
     * The clock is judged at the confirm. The assignment is closed with this
     * attempt only while `expiresAt` is still ahead — the database decides.
     */
    it('closes the task with the hand-in while the clock is ahead', async () => {
      repo.findOne.mockResolvedValue({ ...reserved });
      const result = await service.confirmUpload(PLAYER, 'a1', {
        byteSize: 1,
        durationSeconds: 10,
      });
      expect(assignments.closeWithAttempt).toHaveBeenCalledWith(
        'as1',
        'e1',
        'a1',
      );
      expect(result.status).toBe('submitted');
      expect(assignments.expireOverdue).not.toHaveBeenCalled();
    });

    /**
     * Late is late, whatever the phone said. The file is kept as a rejected
     * row so nothing is orphaned and the record says what happened; the clock
     * is settled at once — a heart, and watcher if it was the last — and the
     * player is told.
     */
    it('keeps a late hand-in as rejected, settles the clock, and says so', async () => {
      repo.findOne.mockResolvedValue({ ...reserved });
      assignments.closeWithAttempt.mockResolvedValue(false);

      await expect(
        service.confirmUpload(PLAYER, 'a1', {
          byteSize: 1,
          durationSeconds: 10,
        }),
      ).rejects.toThrow(ConflictException);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'a1',
          status: 'rejected',
          rejectionReason: 'Handed in after the clock ran out.',
          submittedAt: expect.any(Date) as Date,
        }),
      );
      expect(assignments.expireOverdue).toHaveBeenCalledWith('as1');
      expect(cheatDetector.inspectLater).not.toHaveBeenCalled();
    });

    it('tells the player the time ran out', async () => {
      repo.findOne.mockResolvedValue({ ...reserved });
      assignments.closeWithAttempt.mockResolvedValue(false);
      await expect(
        service.confirmUpload(PLAYER, 'a1', {
          byteSize: 1,
          durationSeconds: 10,
        }),
      ).rejects.toThrow(/Time ran out before you handed in/);
    });

    /**
     * The watchers' window opens at the confirm — not at the reservation,
     * not at the verdict — and shuts three hours later on the server's clock.
     */
    it('opens the vote for exactly three hours from the confirm', async () => {
      repo.findOne.mockResolvedValue({ ...reserved });
      const result = await service.confirmUpload(PLAYER, 'a1', {
        byteSize: 1,
        durationSeconds: 10,
      });
      expect(result.votingStatus).toBe('open');
      expect(result.votingEndsAt).toBeInstanceOf(Date);
      expect(
        (result.votingEndsAt as Date).getTime() -
          (result.submittedAt as Date).getTime(),
      ).toBe(3 * 60 * 60 * 1000);
    });

    /** A late file is kept as a record, but nobody votes on it. */
    it('does not open a vote on a late hand-in', async () => {
      repo.findOne.mockResolvedValue({ ...reserved });
      assignments.closeWithAttempt.mockResolvedValue(false);
      await expect(
        service.confirmUpload(PLAYER, 'a1', {
          byteSize: 1,
          durationSeconds: 10,
        }),
      ).rejects.toThrow(ConflictException);
      const [saved] = repo.save.mock.calls[0] as [
        { votingStatus?: string; votingEndsAt?: Date },
      ];
      expect(saved.votingStatus).not.toBe('open');
      expect(saved.votingEndsAt).toBeUndefined();
    });

    /** Rows from before the clock existed carry no assignment and just submit. */
    it('submits a row with no assignment without touching a clock', async () => {
      repo.findOne.mockResolvedValue({ ...reserved, assignmentId: null });
      const result = await service.confirmUpload(PLAYER, 'a1', {
        byteSize: 1,
        durationSeconds: 10,
      });
      expect(result.status).toBe('submitted');
      expect(assignments.closeWithAttempt).not.toHaveBeenCalled();
      expect(cheatDetector.inspectLater).toHaveBeenCalledWith('a1');
    });

    it('does not ask the detector about a refused confirm', async () => {
      repo.findOne.mockResolvedValue({ ...reserved });
      await expect(
        service.confirmUpload(PLAYER, 'a1', {
          byteSize: 1,
          durationSeconds: 2,
        }),
      ).rejects.toThrow();
      expect(cheatDetector.inspectLater).not.toHaveBeenCalled();
    });

    /**
     * A verdict is what publishes. An unreviewed clip of a stranger in public
     * must not reach the feed because an upload finished.
     */
    it('does not publish it', async () => {
      repo.findOne.mockResolvedValue({ ...reserved });
      const result = await service.confirmUpload(PLAYER, 'a1', {
        byteSize: 1,
        durationSeconds: 10,
      });
      expect(result.status).not.toBe('published');
      expect(result.publishedAt).toBeUndefined();
    });

    /**
     * The reason the rules run twice. The first call only decided whether to
     * spend a URL on a claim; this is the pass that actually holds.
     */
    it('catches a client that lied about the length on the first call', async () => {
      repo.findOne.mockResolvedValue({ ...reserved });
      await expect(
        service.confirmUpload(PLAYER, 'a1', {
          byteSize: 6_000_000,
          durationSeconds: 600,
        }),
      ).rejects.toThrow(/2 minutes or shorter/);
    });

    it('catches one that came back under the floor', async () => {
      repo.findOne.mockResolvedValue({ ...reserved });
      await expect(
        service.confirmUpload(PLAYER, 'a1', {
          byteSize: 1_000,
          durationSeconds: 2,
        }),
      ).rejects.toThrow(/at least 5 seconds/);
    });

    it('refuses to confirm the same attempt twice', async () => {
      repo.findOne.mockResolvedValue({ ...reserved, status: 'submitted' });
      await expect(
        service.confirmUpload(PLAYER, 'a1', {
          byteSize: 1,
          durationSeconds: 10,
        }),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.confirmUpload(PLAYER, 'a1', {
          byteSize: 1,
          durationSeconds: 10,
        }),
      ).rejects.toThrow(/already handed in/);
    });

    /** Scoped to the caller's own enrolment, so ids are not enough. */
    it("will not confirm another player's attempt", async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.confirmUpload(PLAYER, 'someone-elses', {
          byteSize: 1,
          durationSeconds: 10,
        }),
      ).rejects.toThrow(/not found/i);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'someone-elses', enrolmentId: 'e1' },
      });
    });

    it('trims a caption and drops an empty one', async () => {
      repo.findOne.mockResolvedValue({ ...reserved });
      const withText = await service.confirmUpload(PLAYER, 'a1', {
        byteSize: 1,
        durationSeconds: 10,
        caption: '  every black thing I own  ',
      });
      expect(withText.caption).toBe('every black thing I own');

      repo.findOne.mockResolvedValue({ ...reserved });
      const blank = await service.confirmUpload(PLAYER, 'a1', {
        byteSize: 1,
        durationSeconds: 10,
        caption: '   ',
      });
      expect(blank.caption).toBeNull();
    });
  });

  describe('mine', () => {
    it('lists this player’s attempts oldest first', async () => {
      repo.find.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
      const mine = await service.mine(PLAYER);
      expect(mine.map((a) => a.id)).toEqual(['a1', 'a2']);
      expect(repo.find).toHaveBeenCalledWith({
        where: { enrolmentId: 'e1' },
        order: { day: 'ASC', submittedAt: 'ASC', createdAt: 'ASC' },
      });
    });
  });

  /**
   * The same count the nightly sweep makes, asked early so the dashboard can
   * show "2 of 4" rather than let someone find out at midnight.
   */
  describe('handedInToday', () => {
    it('counts confirmed hand-ins since midnight in Tbilisi', async () => {
      repo.query.mockResolvedValue([{ count: 3 }]);
      await expect(service.handedInToday('e1')).resolves.toBe(3);
      const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
      expect(params).toEqual(['e1', 'Asia/Tbilisi']);
      expect(sql).toMatch(/"submittedAt" >= date_trunc\('day'/);
      expect(sql).toMatch(/'submitted', 'published'/);
      expect(sql).not.toMatch(/awaiting_upload/);
    });

    it('is zero when nothing was handed in', async () => {
      repo.query.mockResolvedValue([]);
      await expect(service.handedInToday('e1')).resolves.toBe(0);
    });
  });
});
