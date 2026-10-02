import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Clan wars, and a book of coin bets on each one.
 *
 * Additive throughout, so every branch keeps working against the shared
 * database: two new tables nothing older reads, and a wider list of coin
 * ledger reasons. The CHECK is replaced rather than altered — Postgres has
 * no ALTER for a CHECK's expression — and the new list is a superset of the
 * old, so no existing row can fail it.
 *
 * **Coins only.** There is no column here that holds money, and there
 * should not be: a book on real money is a licensed gambling operation, and
 * the game admits sixteen-year-olds.
 *
 * **What the database holds you to, rather than the service:**
 *
 * - A war is between two *different* clans.
 * - `endsAt` is after `startsAt`.
 * - A settled war has an outcome and a settlement time; an unsettled one has
 *   neither. A void war has a reason.
 * - A stake is at least one coin, and a payout is never negative.
 * - One bet per person per war.
 */
export class GameClanWars1787350000000 implements MigrationInterface {
  name = 'GameClanWars1787350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_clan_wars" (
        "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "seasonId"          uuid NOT NULL,
        "challengerClanId"  uuid NOT NULL,
        "opponentClanId"    uuid NOT NULL,
        "proposedById"      uuid NOT NULL,
        "status"            character varying(16) NOT NULL DEFAULT 'proposed',
        "startsAt"          TIMESTAMP WITH TIME ZONE NOT NULL,
        "endsAt"            TIMESTAMP WITH TIME ZONE NOT NULL,
        "acceptedAt"        TIMESTAMP WITH TIME ZONE,
        "settledAt"         TIMESTAMP WITH TIME ZONE,
        "challengerScore"   integer NOT NULL DEFAULT 0,
        "opponentScore"     integer NOT NULL DEFAULT 0,
        "winnerClanId"      uuid,
        "outcome"           character varying(12),
        "settlementReason"  character varying(16),
        "rakePercent"       smallint NOT NULL DEFAULT 0,
        "rakeCoins"         integer NOT NULL DEFAULT 0,
        "voidReason"        character varying(200),
        "createdAt"         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_game_clan_wars_status"
          CHECK ("status" IN ('proposed', 'accepted', 'live', 'judging', 'settled', 'void')),
        CONSTRAINT "CHK_game_clan_wars_two_clans"
          CHECK ("challengerClanId" <> "opponentClanId"),
        CONSTRAINT "CHK_game_clan_wars_window"
          CHECK ("endsAt" > "startsAt"),
        CONSTRAINT "CHK_game_clan_wars_outcome"
          CHECK ("outcome" IS NULL OR "outcome" IN ('challenger', 'opponent', 'draw', 'void')),
        CONSTRAINT "CHK_game_clan_wars_reason"
          CHECK ("settlementReason" IS NULL OR "settlementReason" IN ('paid', 'draw', 'one_sided', 'no_bets', 'void')),
        CONSTRAINT "CHK_game_clan_wars_settled"
          CHECK (("status" IN ('settled', 'void')) = ("settledAt" IS NOT NULL AND "outcome" IS NOT NULL)),
        CONSTRAINT "CHK_game_clan_wars_void_reason"
          CHECK ("status" <> 'void' OR "voidReason" IS NOT NULL),
        CONSTRAINT "CHK_game_clan_wars_rake"
          CHECK ("rakePercent" BETWEEN 0 AND 50 AND "rakeCoins" >= 0),
        CONSTRAINT "CHK_game_clan_wars_scores"
          CHECK ("challengerScore" >= 0 AND "opponentScore" >= 0),
        CONSTRAINT "FK_game_clan_wars_season"
          FOREIGN KEY ("seasonId") REFERENCES "game_seasons"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_clan_wars_challenger"
          FOREIGN KEY ("challengerClanId") REFERENCES "game_clans"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_clan_wars_opponent"
          FOREIGN KEY ("opponentClanId") REFERENCES "game_clans"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_clan_wars_proposed_by"
          FOREIGN KEY ("proposedById") REFERENCES "game_enrolments"("id") ON DELETE CASCADE
      )
    `);
    for (const [name, cols] of [
      ['IDX_game_clan_wars_season', '"seasonId"'],
      ['IDX_game_clan_wars_season_status', '"seasonId", "status"'],
      ['IDX_game_clan_wars_status_starts', '"status", "startsAt"'],
      ['IDX_game_clan_wars_challenger', '"challengerClanId"'],
      ['IDX_game_clan_wars_opponent', '"opponentClanId"'],
    ] as const) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "${name}" ON "game_clan_wars" (${cols})`,
      );
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_war_bets" (
        "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "warId"        uuid NOT NULL,
        "enrolmentId"  uuid NOT NULL,
        "side"         character varying(11) NOT NULL,
        "stakeCoins"   integer NOT NULL,
        "payoutCoins"  integer NOT NULL DEFAULT 0,
        "settled"      boolean NOT NULL DEFAULT false,
        "createdAt"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_game_war_bets_side" CHECK ("side" IN ('challenger', 'opponent')),
        CONSTRAINT "CHK_game_war_bets_stake" CHECK ("stakeCoins" >= 1),
        CONSTRAINT "CHK_game_war_bets_payout" CHECK ("payoutCoins" >= 0),
        CONSTRAINT "UQ_game_war_bets_war_enrolment" UNIQUE ("warId", "enrolmentId"),
        CONSTRAINT "FK_game_war_bets_war"
          FOREIGN KEY ("warId") REFERENCES "game_clan_wars"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_war_bets_enrolment"
          FOREIGN KEY ("enrolmentId") REFERENCES "game_enrolments"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_war_bets_war" ON "game_war_bets" ("warId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_war_bets_war_side" ON "game_war_bets" ("warId", "side")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_war_bets_enrolment" ON "game_war_bets" ("enrolmentId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "game_coin_ledger" DROP CONSTRAINT IF EXISTS "CHK_game_coin_ledger_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_coin_ledger" ADD CONSTRAINT "CHK_game_coin_ledger_reason"
         CHECK ("reason" IN ('task_reward', 'task_penalty', 'vote_reward', 'purchase',
                             'cheating', 'reinstated', 'admin',
                             'war_stake', 'war_payout', 'war_refund'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Fails if any war row exists in the coin ledger. Correct: that history
    // is somebody's coins, and a migration should not rewrite it.
    await queryRunner.query(
      `ALTER TABLE "game_coin_ledger" DROP CONSTRAINT IF EXISTS "CHK_game_coin_ledger_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_coin_ledger" ADD CONSTRAINT "CHK_game_coin_ledger_reason"
         CHECK ("reason" IN ('task_reward', 'task_penalty', 'vote_reward', 'purchase',
                             'cheating', 'reinstated', 'admin'))`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "game_war_bets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_clan_wars"`);
  }
}
