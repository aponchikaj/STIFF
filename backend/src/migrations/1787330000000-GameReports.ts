import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reports: one person saying something in the game is wrong.
 *
 * Additive throughout, so every branch keeps working against the shared
 * database: one new table, and a nullable `hiddenAt` on hand-ins and
 * comments that older code never reads.
 *
 * **`game_reports`.** Who reported what, for which reason, with a copy of
 * the thing as it was (`snapshot`), and what an admin did about it. The
 * reporter and the account it is about are `SET NULL` on deletion — the
 * history outlives both. `UQ_game_reports_open_reporter_target` is partial:
 * one *open* report per person per thing, and a fresh one after a
 * dismissal is allowed.
 *
 * **`hiddenAt`.** When enough different people report the same hand-in or
 * comment it is hidden from the feed before anyone has looked; the reports'
 * resolution restores it or removes it properly.
 */
export class GameReports1787330000000 implements MigrationInterface {
  name = 'GameReports1787330000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "game_attempts" ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_attempt_comments" ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP WITH TIME ZONE`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_reports" (
        "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "seasonId"        uuid,
        "reporterId"      uuid,
        "reporterHandle"  character varying(24) NOT NULL,
        "targetType"      character varying(16) NOT NULL,
        "targetId"        uuid,
        "targetUserId"    uuid,
        "snapshot"        jsonb NOT NULL DEFAULT '{}',
        "reason"          character varying(32) NOT NULL,
        "details"         character varying(1000),
        "tags"            jsonb NOT NULL DEFAULT '[]',
        "context"         character varying(300),
        "priority"        smallint NOT NULL DEFAULT 1,
        "status"          character varying(16) NOT NULL DEFAULT 'open',
        "assignedTo"      uuid,
        "action"          character varying(24),
        "note"            character varying(1000),
        "reporterMessage" character varying(500),
        "resolvedBy"      uuid,
        "resolvedAt"      TIMESTAMP WITH TIME ZONE,
        "createdAt"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_game_reports_target_type"
          CHECK ("targetType" IN ('attempt', 'comment', 'user', 'task', 'shop_item', 'clan', 'purchase', 'app')),
        CONSTRAINT "CHK_game_reports_target"
          CHECK (("targetType" = 'app' AND "targetId" IS NULL) OR ("targetType" <> 'app' AND "targetId" IS NOT NULL)),
        CONSTRAINT "CHK_game_reports_status"
          CHECK ("status" IN ('open', 'reviewing', 'resolved', 'dismissed', 'withdrawn')),
        CONSTRAINT "CHK_game_reports_priority" CHECK ("priority" BETWEEN 0 AND 3),
        CONSTRAINT "CHK_game_reports_action"
          CHECK ("action" IS NULL OR "action" IN ('none', 'remove_content', 'restore_content', 'warn_user', 'flag_cheater', 'reinstate', 'retire_task', 'archive_item')),
        CONSTRAINT "CHK_game_reports_closed"
          CHECK (("status" IN ('resolved', 'dismissed')) = ("resolvedAt" IS NOT NULL)),
        CONSTRAINT "FK_game_reports_season"
          FOREIGN KEY ("seasonId") REFERENCES "game_seasons"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_game_reports_reporter"
          FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_game_reports_target_user"
          FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // One open report per person per thing. Partial, so history never blocks
    // a fresh report after a dismissal, and `app` reports (no target) never
    // collide.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_game_reports_open_reporter_target"
         ON "game_reports" ("reporterId", "targetType", "targetId")
         WHERE "status" IN ('open', 'reviewing') AND "targetId" IS NOT NULL`,
    );
    // The queue: open first, most urgent first, oldest first.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_reports_queue"
         ON "game_reports" ("status", "priority", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_reports_target"
         ON "game_reports" ("targetType", "targetId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_reports_target_user"
         ON "game_reports" ("targetUserId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_reports_reporter_created"
         ON "game_reports" ("reporterId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_reports_season"
         ON "game_reports" ("seasonId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "game_reports"`);
    await queryRunner.query(
      `ALTER TABLE "game_attempt_comments" DROP COLUMN IF EXISTS "hiddenAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_attempts" DROP COLUMN IF EXISTS "hiddenAt"`,
    );
  }
}
