import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/user.entity';
import { AttemptsService } from './attempts.service';
import {
  GameAttempt,
  GameAttemptComment,
  GameAttemptReaction,
  GameEnrolment,
  GameGenerationRejection,
  GameSeason,
  GameTaskTemplate,
} from './entities';
import { EnrolmentsService } from './enrolments.service';
import { GameAdminController } from './game-admin.controller';
import { GameAdminService } from './game-admin.service';
import { FeedService } from './feed.service';
import { GameController } from './game.controller';
import { LeaderboardService } from './leaderboard.service';
import { MediaStorageService } from './media-storage.service';
import { SeasonsService } from './seasons.service';
import { TaskGeneratorService } from './ai/task-generator.service';
import { TaskTemplatesService } from './task-templates.service';

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
      GameTaskTemplate,
      GameGenerationRejection,
      // Not a game table. `EnrolmentsService` keeps the side someone picked
      // before there was a season to join, and `users.settings` is where a
      // per-account preference already lives — no new table for one key.
      User,
    ]),
    AuthModule,
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
    TaskGeneratorService,
    TaskTemplatesService,
  ],
  exports: [SeasonsService, EnrolmentsService],
})
export class GameModule {}
