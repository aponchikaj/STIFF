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
import { CheatDetectorService } from './ai/cheat-detector.service';
import { AssignmentsService } from './assignments.service';
import { GameAttempt } from './entities/game-attempt.entity';
import { EnrolmentsService } from './enrolments.service';
import { checkMedia, extensionFor, storedDuration } from './media-rules';
import { MediaStorageService } from './media-storage.service';
import { GAME_TIMEZONE, VOTING_WINDOW_HOURS } from './rules';
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
    private readonly assignments: AssignmentsService,
    private readonly storage: MediaStorageService,
    private readonly cheatDetector: CheatDetectorService,
  ) {}

  /**
   * Step one of two: open an attempt and hand back a URL.
   *
   * **Every hand-in is against an accepted task with time left.** The day and
   * the task come from the assignment, not from the client; a task that was
   * never accepted, was declined, or whose clock has run out is refused with
   * what it actually is.
   *
   * **There is no limit on how many a player opens in a day.** Four is the
   * floor, not the ceiling — see `DisciplineService.sweepDailyMinimum`. So
   * this is a plain insert: nothing to reserve, nothing to conflict with. An
   * upload the browser abandons leaves a row in `awaiting_upload` that never
   * counts for anything.
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
    const assignment = await this.assignments.requireOpen(
      enrolment.id,
      dto.assignmentId,
    );
    const day = assignment.day;

    // The task says how it is proved, and the upload has to be that. A
    // "take a video" dare handed in as a still is not the dare.
    const proof = assignment.taskTemplate?.proof ?? 'either';
    if (proof !== 'either' && proof !== dto.kind) {
      throw new BadRequestException(
        proof === 'video'
          ? 'This task asks for a video.'
          : 'This task asks for a photo.',
      );
    }

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

    const inserted = returnedRows(
      await this.attemptRepo.query(
        `INSERT INTO "game_attempts"
           ("seasonId", "enrolmentId", "taskTemplateId", "assignmentId", "day", "kind",
            "status", "objectKey", "mediaUrl", "mimeType", "byteSize", "durationSeconds")
         VALUES ($1, $2, $3, $4, $5, $6, 'awaiting_upload', $7, NULL, $8, $9, $10)
         RETURNING "id"`,
        [
          season.id,
          enrolment.id,
          assignment.taskTemplateId,
          assignment.id,
          day,
          dto.kind,
          objectKey,
          dto.mimeType,
          dto.byteSize,
          storedDuration(dto),
        ],
      ),
    ) as { id: string }[];

    return {
      attemptId: inserted[0].id,
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
   *
   * `submittedAt` is written here and nowhere else: it is the timestamp the
   * daily minimum counts, and the confirm is the moment the player actually
   * handed something in. The cheat check starts after the save and off the
   * request — the player is not kept waiting on a model.
   *
   * **The clock is judged here.** The assignment is closed with this attempt
   * only if `expiresAt` is still ahead; a confirm that arrives after it is
   * kept as a rejected row (so the file is not orphaned and the record says
   * what happened), the clock is settled at once — a heart, and watcher if
   * it was the last — and the player is told the time ran out.
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
      throw new ConflictException('That attempt is already handed in.');
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
    attempt.submittedAt = new Date();

    const inTime = attempt.assignmentId
      ? await this.assignments.closeWithAttempt(
          attempt.assignmentId,
          enrolment.id,
          attempt.id,
        )
      : true;

    if (!inTime) {
      attempt.status = 'rejected';
      attempt.rejectionReason = 'Handed in after the clock ran out.';
      await this.attemptRepo.save(attempt);
      await this.assignments.expireOverdue(attempt.assignmentId ?? undefined);
      throw new ConflictException('Time ran out before you handed in.');
    }

    // `submitted`, not `published`. A verdict is what puts it in the feed —
    // an unreviewed clip of a stranger in public is not something to publish
    // because an upload finished.
    attempt.status = 'submitted';
    // The watchers' window opens now and closes in three hours; the
    // resolver settles it then, or a reviewer settles it sooner.
    attempt.votingStatus = 'open';
    attempt.votingEndsAt = new Date(
      attempt.submittedAt.getTime() + VOTING_WINDOW_HOURS * 3_600_000,
    );

    const saved = await this.attemptRepo.save(attempt);
    this.cheatDetector.inspectLater(saved.id);
    return saved;
  }

  /** What this player has handed in so far, oldest first. */
  async mine(user: User): Promise<GameAttempt[]> {
    const enrolment = await this.enrolmentsService.require(user, 'player');
    return this.attemptRepo.find({
      where: { enrolmentId: enrolment.id },
      order: { day: 'ASC', submittedAt: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * How many this enrolment has handed in today, Tbilisi time.
   *
   * The same count the nightly sweep will make, asked early so the dashboard
   * can show "2 of 4" rather than let someone find out at midnight. Rejected
   * attempts do not count; ones still waiting for a verdict do.
   */
  async handedInToday(enrolmentId: string): Promise<number> {
    const rows = returnedRows(
      await this.attemptRepo.query(
        `SELECT count(*)::int AS "count"
           FROM "game_attempts"
          WHERE "enrolmentId" = $1
            AND "status" IN ('submitted', 'published')
            AND "submittedAt" >= date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2`,
        [enrolmentId, GAME_TIMEZONE],
      ),
    ) as { count: number }[];
    return rows[0]?.count ?? 0;
  }
}
