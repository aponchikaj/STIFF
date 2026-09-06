import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { returnedRows } from '../common/utils/returned-rows';
import { User } from '../users/user.entity';
import { GameAttempt } from './entities/game-attempt.entity';
import { EnrolmentsService } from './enrolments.service';
import {
  checkMedia,
  extensionFor,
  isSeasonDay,
  storedDuration,
} from './media-rules';
import { MediaStorageService } from './media-storage.service';
import { SeasonsService } from './seasons.service';
import type { ConfirmAttemptDto, RequestUploadDto } from './dto/game.dto';

export interface UploadTicket {
  attemptId: string;
  uploadUrl: string;
  /** The browser must send exactly this, because it is signed into the URL. */
  contentType: string;
  expiresAt: string;
}

@Injectable()
export class AttemptsService {
  constructor(
    @InjectRepository(GameAttempt)
    private readonly attemptRepo: Repository<GameAttempt>,
    private readonly seasonsService: SeasonsService,
    private readonly enrolmentsService: EnrolmentsService,
    private readonly storage: MediaStorageService,
  ) {}

  /**
   * Step one of two: reserve the day and hand back a URL.
   *
   * The rules run here *and* on confirm. A client reports its own duration and
   * size, so this pass decides whether to spend an upload URL at all, and the
   * confirm pass is what actually holds — a client that lies here is caught
   * there, before anything reaches the feed.
   */
  async requestUpload(
    user: User,
    dto: RequestUploadDto,
  ): Promise<UploadTicket> {
    const season = await this.seasonsService.requireCurrent();
    const enrolment = await this.enrolmentsService.require(user, 'player');

    if (!isSeasonDay(dto.day)) {
      throw new BadRequestException('There are three days.');
    }
    const day = dto.day;

    const check = checkMedia({
      kind: dto.kind,
      mimeType: dto.mimeType,
      byteSize: dto.byteSize,
      durationSeconds: dto.durationSeconds,
    });
    if (!check.ok) throw new BadRequestException(check.reason);

    const objectKey = this.storage.mintObjectKey(
      season.slug,
      day,
      extensionFor(dto.mimeType),
    );
    const presigned = this.storage.presignPut(objectKey, dto.mimeType);

    // One statement, because read-then-write loses the double tap.
    //
    // Two requests for the same day arriving together would both find no row
    // and both insert, and the second would hit
    // `UQ_game_attempts_enrolment_day` as an unhandled driver error — a 500 for
    // someone who pressed a button twice. `ON CONFLICT ... DO UPDATE` lets the
    // database decide instead, and the `WHERE` is what keeps the rule intact:
    //
    //   no row yet              -> inserted
    //   row in awaiting_upload  -> reservation replaced, so a player who lost
    //                              signal and retried is not locked out of
    //                              their own day
    //   row already handed in   -> the update matches nothing, RETURNING comes
    //                              back empty, and that empty is the conflict
    //
    // Same shape as the stock decrement and the order cancel: the condition
    // lives in the statement that acts on it, not in a read taken beforehand.
    const claimed = returnedRows(
      await this.attemptRepo.query(
        `INSERT INTO "game_attempts"
           ("seasonId", "enrolmentId", "day", "kind", "status",
            "objectKey", "mediaUrl", "mimeType", "byteSize", "durationSeconds")
         VALUES ($1, $2, $3, $4, 'awaiting_upload', $5, NULL, $6, $7, $8)
         ON CONFLICT ("enrolmentId", "day") DO UPDATE
           SET "kind"            = EXCLUDED."kind",
               "objectKey"       = EXCLUDED."objectKey",
               "mimeType"        = EXCLUDED."mimeType",
               "byteSize"        = EXCLUDED."byteSize",
               "durationSeconds" = EXCLUDED."durationSeconds",
               "mediaUrl"        = NULL,
               "updatedAt"       = now()
           WHERE "game_attempts"."status" = 'awaiting_upload'
         RETURNING "id"`,
        [
          season.id,
          enrolment.id,
          day,
          dto.kind,
          objectKey,
          dto.mimeType,
          dto.byteSize,
          storedDuration(dto),
        ],
      ),
    ) as { id: string }[];

    if (claimed.length === 0) {
      throw new ConflictException('You have already handed in for that day.');
    }

    return {
      attemptId: claimed[0].id,
      uploadUrl: presigned.url,
      contentType: dto.mimeType,
      expiresAt: presigned.expiresAt.toISOString(),
    };
  }

  /**
   * Step two: the bytes are in storage, so the row becomes an attempt.
   *
   * The rules run again against what the client now says the file was. Nothing
   * here trusts the first call — that one only decided whether to hand out a
   * URL.
   */
  async confirmUpload(
    user: User,
    attemptId: string,
    dto: ConfirmAttemptDto,
  ): Promise<GameAttempt> {
    const enrolment = await this.enrolmentsService.require(user, 'player');
    const attempt = await this.attemptRepo.findOne({
      where: { id: attemptId, enrolmentId: enrolment.id },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.status !== 'awaiting_upload') {
      throw new ConflictException('That day is already handed in.');
    }

    const check = checkMedia({
      kind: attempt.kind,
      mimeType: attempt.mimeType,
      byteSize: dto.byteSize,
      durationSeconds: dto.durationSeconds,
    });
    if (!check.ok) throw new BadRequestException(check.reason);

    attempt.byteSize = dto.byteSize;
    attempt.durationSeconds = storedDuration({
      kind: attempt.kind,
      mimeType: attempt.mimeType,
      byteSize: dto.byteSize,
      durationSeconds: dto.durationSeconds,
    });
    attempt.width = dto.width ?? null;
    attempt.height = dto.height ?? null;
    attempt.caption = dto.caption?.trim() || null;
    attempt.mediaUrl = this.storage.publicUrlFor(attempt.objectKey);
    // `submitted`, not `published`. A verdict is what puts it in the feed —
    // an unreviewed clip of a stranger in public is not something to publish
    // because an upload finished.
    attempt.status = 'submitted';

    return this.attemptRepo.save(attempt);
  }

  /** What this player has handed in so far, oldest day first. */
  async mine(user: User): Promise<GameAttempt[]> {
    const enrolment = await this.enrolmentsService.require(user, 'player');
    return this.attemptRepo.find({
      where: { enrolmentId: enrolment.id },
      order: { day: 'ASC' },
    });
  }
}
