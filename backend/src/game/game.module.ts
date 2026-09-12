import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/user.entity';
import { AssignmentsService } from './assignments.service';
import { AttemptsService } from './attempts.service';
import { CheatDetectorService } from './ai/cheat-detector.service';
import { ClansController } from './clans.controller';
import { ClansService } from './clans.service';
import { DisciplineService } from './discipline.service';
import { EconomyService } from './economy.service';
import {
  GameAttempt,
  GameAttemptComment,
  GameAttemptReaction,
  GameAttemptVote,
  GameClan,
  GameClanMember,
  GameCoinLedger,
  GameEnrolment,
  GameGenerationRejection,
  GamePurchase,
  GameReport,
  GameShopItem,
  GameScoreLedger,
  GameSeason,
  GameTaskAssignment,
  GameTaskTemplate,
} from './entities';
import { EnrolmentsService } from './enrolments.service';
import { GameAdminController } from './game-admin.controller';
import { GameAdminService } from './game-admin.service';
import { FeedService } from './feed.service';
import { GameController } from './game.controller';
import { LeaderboardService } from './leaderboard.service';
import { MediaStorageService } from './media-storage.service';
import { ReportsAdminController } from './reports/reports-admin.controller';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { SeasonsService } from './seasons.service';
import { TaskGeneratorService } from './ai/task-generator.service';
import { TaskPipelineService } from './ai/task-pipeline.service';
import { TaskReviewerService } from './ai/task-reviewer.service';
import { TaskTemplatesService } from './task-templates.service';
import { VoteResolverService } from './ai/vote-resolver.service';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { VerdictsService } from './verdicts.service';
import { VotingController } from './voting.controller';
import { VotingService } from './voting.service';

/**
 * The game's own slice of the API, under `/api/game/*`.
 *
 * Ships on every branch the way `src/staff/` and `src/admin/` do — the extra
 * Next app lives only on `game`, but one Nest app serves all of them, so the
 * module has to be here wherever the backend is deployed.
 *
 * The rules that move a player to watcher — the cheat detector, the nightly
 * sweeps, the task clock — live here too (`DisciplineService`,
 * `CheatDetectorService`, `AssignmentsService`), and `NotificationsModule` is
 * imported so the person is told when one fires.
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
      GameTaskAssignment,
      GameGenerationRejection,
      GameClan,
      GameClanMember,
      GameCoinLedger,
      GameScoreLedger,
      GameAttemptVote,
      GameShopItem,
      GamePurchase,
      GameReport,
      // Not a game table. `EnrolmentsService` keeps the side someone picked
      // before there was a season to join and the date of birth the age gate
      // checks, and `users` is where both already live — no new table.
      User,
    ]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [
    GameController,
    ClansController,
    ShopController,
    VotingController,
    ReportsController,
    ReportsAdminController,
    GameAdminController,
  ],
  providers: [
    SeasonsService,
    EnrolmentsService,
    AssignmentsService,
    AttemptsService,
    FeedService,
    LeaderboardService,
    MediaStorageService,
    GameAdminService,
    TaskGeneratorService,
    TaskReviewerService,
    TaskPipelineService,
    TaskTemplatesService,
    DisciplineService,
    EconomyService,
    ClansService,
    VerdictsService,
    ShopService,
    VoteResolverService,
    VotingService,
    CheatDetectorService,
    ReportsService,
  ],
  exports: [SeasonsService, EnrolmentsService],
})
export class GameModule {}
