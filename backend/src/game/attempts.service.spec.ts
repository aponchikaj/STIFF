import { BadRequestException, ConflictException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../users/user.entity';
import { AttemptsService } from './attempts.service';
import { GameAttempt } from './entities/game-attempt.entity';
import { EnrolmentsService } from './enrolments.service';
import { MediaStorageService } from './media-storage.service';
import { SeasonsService } from './seasons.service';

/**
 * Handing in a day's proof.
 *
 * There is no live streaming, so an attempt is a file: a still, or a clip
 * between five seconds and two minutes. The interesting property is that the
 * limits are checked **twice** — once to decide whether to spend an upload URL
 * on a client's claim, and once when the client comes back and says it is
 * done. Only the second one is a guarantee.
 */

const PLAYER = { id: 'u1', username: 'asterisk' } as User;

function clip(overrides: Record<string, unknown> = {}) {
  return {
    day: 1,
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
  };
  let enrolments: { require: jest.Mock };
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
    };
    enrolments = {
      require: jest.fn().mockResolvedValue({ id: 'e1', role: 'player' }),
    };
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
        { provide: MediaStorageService, useValue: storage },
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

    it('reserves the row before the file exists', async () => {
      await service.requestUpload(PLAYER, clip());
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'awaiting_upload',
          mediaUrl: null,
          objectKey: 'seasons/zero/day-1/deadbeef.mp4',
        }),
      );
    });

    /** The key is minted by the server; a filename cannot steer it. */
    it('never takes the object key from the client', async () => {
      await service.requestUpload(PLAYER, clip());
      expect(storage.mintObjectKey).toHaveBeenCalledWith(
        'season-zero',
        1,
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
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'photo', durationSeconds: null }),
      );
    });

    it('refuses a day that is not on the ladder', async () => {
      await expect(
        service.requestUpload(PLAYER, clip({ day: 4 })),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a second hand-in for a day already submitted', async () => {
      repo.findOne.mockResolvedValue({ id: 'a1', status: 'submitted' });
      await expect(service.requestUpload(PLAYER, clip())).rejects.toThrow(
        ConflictException,
      );
    });

    /**
     * A player who starts an upload, loses signal and retries must not be
     * locked out of their own day by the row they abandoned.
     */
    it('replaces an abandoned reservation rather than blocking it', async () => {
      repo.findOne.mockResolvedValue({ id: 'a1', status: 'awaiting_upload' });
      await service.requestUpload(PLAYER, clip());
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'a1', status: 'awaiting_upload' }),
      );
    });
  });

  describe('confirmUpload', () => {
    const reserved = {
      id: 'a1',
      enrolmentId: 'e1',
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

    it('refuses to confirm the same day twice', async () => {
      repo.findOne.mockResolvedValue({ ...reserved, status: 'submitted' });
      await expect(
        service.confirmUpload(PLAYER, 'a1', {
          byteSize: 1,
          durationSeconds: 10,
        }),
      ).rejects.toThrow(ConflictException);
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
});
