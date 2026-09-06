import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

    const existing = await this.attemptRepo.findOne({
      where: { enrolmentId: enrolment.id, day },
    });
    if (existing && existing.status !== 'awaiting_upload') {
      throw new ConflictException('You have already handed in for that day.');
    }

    const objectKey = this.storage.mintObjectKey(
      season.slug,
      day,
      extensionFor(dto.mimeType),
    );
    const presigned = this.storage.presignPut(objectKey, dto.mimeType);

    // An abandoned upload leaves a row in `awaiting_upload` rather than a
    // second row: asking twice for the same day replaces the reservation, so
    // a player who backs out and retries is not locked out of their own day.
    const attempt = await this.attemptRepo.save(
      this.attemptRepo.create({
        ...(existing ? { id: existing.id } : {}),
        seasonId: season.id,
        enrolmentId: enrolment.id,
        day,
        kind: dto.kind,
        status: 'awaiting_upload',
        objectKey,
        mediaUrl: null,
        mimeType: dto.mimeType,
        byteSize: dto.byteSize,
        durationSeconds: storedDuration(dto),
      }),
    );

    return {
      attemptId: attempt.id,
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
