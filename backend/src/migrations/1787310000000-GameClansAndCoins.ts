import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Clans of two, coins, and team tasks.
 *
 * Additive throughout — two new tables, a ledger, and defaulted columns —
 * so every branch keeps working against the shared database.
 *
 * **Coins.** `game_enrolments.coins` is the running total; `game_coin_ledger`
 * is the record it is derived from, written in the same transaction. The
 * ledger is append-only by intent, like `admin_audit_logs`.
 *
 * **Clans.** `game_clans` is the pair; `game_clan_members` is who is in it.
 * `UQ_game_clan_members_enrolment` makes one-clan-per-person a fact and
 * `UQ_game_clan_members_clan_role` makes one-leader-one-member one, so a
 * clan holds two at most without anybody counting.
 *
 * **Team tasks.** `game_task_templates.mode` says who a task is for, and the
 * reward and penalty columns say what it pays and what failing it costs.
 * `game_task_assignments.clanId` marks a draw made for a clan.
 */
export class GameClansAndCoins1787310000000 implements MigrationInterface {
  name = 'GameClansAndCoins1787310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "game_enrolments" ADD COLUMN IF NOT EXISTS "coins" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_enrolments" DROP CONSTRAINT IF EXISTS "CHK_game_enrolments_coins"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_enrolments" ADD CONSTRAINT "CHK_game_enrolments_coins" CHECK ("coins" >= 0)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_coin_ledger" (
        "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "enrolmentId"  uuid NOT NULL,
        "delta"        integer NOT NULL,
        "balanceAfter" integer NOT NULL,
        "reason"       character varying(24) NOT NULL,
        "refType"      character varying(24),
        "refId"        uuid,
        "createdAt"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_game_coin_ledger_reason"
          CHECK ("reason" IN ('task_reward', 'task_penalty', 'cheating', 'reinstated', 'admin')),
        CONSTRAINT "FK_game_coin_ledger_enrolment"
          FOREIGN KEY ("enrolmentId") REFERENCES "game_enrolments"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_coin_ledger_enrolment_created" ON "game_coin_ledger" ("enrolmentId", "createdAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_clans" (
        "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "seasonId"   uuid NOT NULL,
        "name"       character varying(24) NOT NULL,
        "nameKey"    character varying(24) NOT NULL,
        "status"     character varying(16) NOT NULL DEFAULT 'forming',
        "inviteCode" character varying(12) NOT NULL,
        "createdAt"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_game_clans_season_name" UNIQUE ("seasonId", "nameKey"),
        CONSTRAINT "UQ_game_clans_invite_code" UNIQUE ("inviteCode"),
        CONSTRAINT "CHK_game_clans_status" CHECK ("status" IN ('forming', 'full', 'disbanded')),
        CONSTRAINT "FK_game_clans_season"
          FOREIGN KEY ("seasonId") REFERENCES "game_seasons"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_clans_season_status" ON "game_clans" ("seasonId", "status")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_clan_members" (
        "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "clanId"      uuid NOT NULL,
        "enrolmentId" uuid NOT NULL,
        "role"        character varying(8) NOT NULL,
        "createdAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_game_clan_members_enrolment" UNIQUE ("enrolmentId"),
        CONSTRAINT "UQ_game_clan_members_clan_role" UNIQUE ("clanId", "role"),
        CONSTRAINT "CHK_game_clan_members_role" CHECK ("role" IN ('leader', 'member')),
        CONSTRAINT "FK_game_clan_members_clan"
          FOREIGN KEY ("clanId") REFERENCES "game_clans"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_clan_members_enrolment"
          FOREIGN KEY ("enrolmentId") REFERENCES "game_enrolments"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_clan_members_clan" ON "game_clan_members" ("clanId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "game_task_templates"
         ADD COLUMN IF NOT EXISTS "mode" character varying(8) NOT NULL DEFAULT 'solo',
         ADD COLUMN IF NOT EXISTS "rewardNerve" integer NOT NULL DEFAULT 0,
         ADD COLUMN IF NOT EXISTS "rewardCoins" integer NOT NULL DEFAULT 0,
         ADD COLUMN IF NOT EXISTS "penaltyCoins" smallint NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_task_templates" DROP CONSTRAINT IF EXISTS "CHK_game_task_templates_mode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_task_templates" ADD CONSTRAINT "CHK_game_task_templates_mode" CHECK ("mode" IN ('solo', 'team'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_task_templates" DROP CONSTRAINT IF EXISTS "CHK_game_task_templates_economy"`,
    );
    // The penalty rule — one to three coins — held in the database, so no
    // writer can file a task that costs a clan ten.
    await queryRunner.query(
      `ALTER TABLE "game_task_templates" ADD CONSTRAINT "CHK_game_task_templates_economy"
         CHECK ("rewardNerve" >= 0 AND "rewardCoins" >= 0 AND "penaltyCoins" BETWEEN 1 AND 3)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_task_templates_mode" ON "game_task_templates" ("mode")`,
    );

    await queryRunner.query(
      `ALTER TABLE "game_task_assignments" ADD COLUMN IF NOT EXISTS "clanId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_task_assignments" DROP CONSTRAINT IF EXISTS "FK_game_task_assignments_clan"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_task_assignments" ADD CONSTRAINT "FK_game_task_assignments_clan"
         FOREIGN KEY ("clanId") REFERENCES "game_clans"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_task_assignments_clan" ON "game_task_assignments" ("clanId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_game_task_assignments_clan"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_task_assignments" DROP CONSTRAINT IF EXISTS "FK_game_task_assignments_clan"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_task_assignments" DROP COLUMN IF EXISTS "clanId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_game_task_templates_mode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_task_templates" DROP CONSTRAINT IF EXISTS "CHK_game_task_templates_economy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_task_templates" DROP CONSTRAINT IF EXISTS "CHK_game_task_templates_mode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_task_templates"
         DROP COLUMN IF EXISTS "penaltyCoins",
         DROP COLUMN IF EXISTS "rewardCoins",
         DROP COLUMN IF EXISTS "rewardNerve",
         DROP COLUMN IF EXISTS "mode"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "game_clan_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_clans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_coin_ledger"`);
    await queryRunner.query(
      `ALTER TABLE "game_enrolments" DROP CONSTRAINT IF EXISTS "CHK_game_enrolments_coins"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_enrolments" DROP COLUMN IF EXISTS "coins"`,
    );
  }
}
