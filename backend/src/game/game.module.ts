import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttemptsService } from './attempts.service';
import {
  GameAttempt,
  GameAttemptComment,
  GameAttemptReaction,
  GameEnrolment,
  GameSeason,
} from './entities';
import { EnrolmentsService } from './enrolments.service';
import { GameAdminController } from './game-admin.controller';
import { GameAdminService } from './game-admin.service';
import { FeedService } from './feed.service';
import { GameController } from './game.controller';
import { LeaderboardService } from './leaderboard.service';
import { MediaStorageService } from './media-storage.service';
import { SeasonsService } from './seasons.service';

/**
 * The game's own slice of the API, under `/api/game/*`.
 *
 * Ships on every branch the way `src/staff/` and `src/admin/` do — the extra
 * Next app lives only on `game`, but one Nest app serves all of them, so the
 * module has to be here wherever the backend is deployed.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      GameSeason,
      GameEnrolment,
      GameAttempt,
      GameAttemptReaction,
      GameAttemptComment,
    ]),
  ],
  controllers: [GameController, GameAdminController],
  providers: [
    SeasonsService,
    EnrolmentsService,
    AttemptsService,
    FeedService,
    LeaderboardService,
    MediaStorageService,
    GameAdminService,
  ],
  exports: [SeasonsService, EnrolmentsService],
})
export class GameModule {}
