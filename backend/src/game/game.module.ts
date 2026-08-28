import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameController } from './game.controller';
import {
  Chart,
  CoinLedgerEntry,
  EconomyConfig,
  FeatureFlag,
  GameCharacter,
  GameUserSettings,
  Inventory,
  Item,
  LeaderboardEntry,
  Level,
  LevelSong,
  Loadout,
  Purchase,
  Run,
  RunRejection,
  RunToken,
  Song,
  Stage,
} from './entities';

/**
 * `/api/game/*` — the rhythm game on game.stiff.ge.
 *
 * game.stiff.ge runs on its own origin but deliberately *not* its own session.
 *
 * Staff and admin each carry a JWT audience because they are privileged
 * surfaces: a staff token must never post a comment as its owner, and an admin
 * token must never place an order. A player is none of those things — they are
 * an ordinary shop user who is also playing — so the game reuses the shop
 * session unchanged, and there is no `GAME_JWT_AUDIENCE` anywhere on purpose.
 *
 * The practical consequence is that `JwtAuthGuard` needs no game-specific
 * branch: `/api/game/*` is protected exactly like `/api/orders`, and a staff
 * or admin token presented to it is rejected by the existing audience check.
 * The cost is that widening the shop cookie to `.stiff.ge` — which is what
 * makes the session visible here at all — also exposes it to every other
 * subdomain. See `cookieDomain()` in `auth.controller.ts`.
 *
 * The panel's game work follows the same rule the rest of the admin panel
 * does: it lives on the shop's own controllers under `@Roles('admin')` rather
 * than in `backend/src/admin/`, so there is one implementation of "approve a
 * chart" and the existing audit interceptor covers it for free.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Song,
      Chart,
      GameCharacter,
      Stage,
      Level,
      LevelSong,
      GameUserSettings,
      Run,
      RunToken,
      RunRejection,
      LeaderboardEntry,
      CoinLedgerEntry,
      Item,
      Inventory,
      Loadout,
      Purchase,
      EconomyConfig,
      FeatureFlag,
    ]),
  ],
  controllers: [GameController],
})
export class GameModule {}
