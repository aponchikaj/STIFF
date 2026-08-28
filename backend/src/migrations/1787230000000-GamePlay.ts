import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What happens when someone actually plays: their calibration, their runs,
 * the runs the server refused, and the boards those runs land on.
 *
 * Mirrored by `1787230000000-GamePlay.ts`. This file is the reviewable record
 * of what actually touches the database.
 *
 * All new tables, all prefixed `game_`. Nothing existing is altered.
 */
export class GamePlay1787230000000 implements MigrationInterface {
  name = 'GamePlay1787230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_user_settings" (
        "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"         uuid NOT NULL,
        "deviceClass"    character varying(16) NOT NULL,
        "audioOffsetMs"  integer NOT NULL DEFAULT 0,
        "visualOffsetMs" integer NOT NULL DEFAULT 0,
        "keybinds"       jsonb NOT NULL DEFAULT '{}'::jsonb,
        "scrollSpeed"    double precision NOT NULL DEFAULT 2.4,
        "reducedMotion"  boolean NOT NULL DEFAULT false,
        "laneColorMode"  character varying(24) NOT NULL DEFAULT 'default',
        "calibratedAt"   TIMESTAMP WITH TIME ZONE,
        "createdAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_game_user_settings_deviceClass"
          CHECK ("deviceClass" IN ('desktop','mobile','tablet')),
        CONSTRAINT "CHK_game_user_settings_laneColorMode"
          CHECK ("laneColorMode" IN ('default','highContrast','deuteranopia','protanopia')),
        CONSTRAINT "CHK_game_user_settings_audioOffsetMs"
          CHECK ("audioOffsetMs" BETWEEN -1000 AND 1000),
        CONSTRAINT "CHK_game_user_settings_visualOffsetMs"
          CHECK ("visualOffsetMs" BETWEEN -1000 AND 1000),
        CONSTRAINT "CHK_game_user_settings_scrollSpeed"
          CHECK ("scrollSpeed" > 0 AND "scrollSpeed" <= 10),
        CONSTRAINT "FK_game_user_settings_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_game_user_settings_device" UNIQUE ("userId", "deviceClass")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_runs" (
        "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"          uuid NOT NULL,
        "chartId"         uuid NOT NULL,
        "chartHash"       character varying(64) NOT NULL,
        "score"           integer NOT NULL,
        "accuracy"        numeric(6,3) NOT NULL,
        "maxCombo"        integer NOT NULL DEFAULT 0,
        "rank"            character varying(2) NOT NULL,
        "judgements"      jsonb NOT NULL DEFAULT '{}'::jsonb,
        "elapsedMs"       integer NOT NULL,
        "validated"       boolean NOT NULL DEFAULT false,
        "practiceMode"    boolean NOT NULL DEFAULT false,
        "replayKey"       character varying(512),
        "createdAt"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_game_runs_rank"
          CHECK ("rank" IN ('P','S','A','B','C','D','F')),
        CONSTRAINT "CHK_game_runs_accuracy"
          CHECK ("accuracy" >= 0 AND "accuracy" <= 100),
        CONSTRAINT "CHK_game_runs_maxCombo" CHECK ("maxCombo" >= 0),
        CONSTRAINT "CHK_game_runs_elapsedMs" CHECK ("elapsedMs" >= 0),
        CONSTRAINT "CHK_game_runs_practice_not_validated"
          CHECK (NOT ("practiceMode" AND "validated")),
        CONSTRAINT "FK_game_runs_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_runs_chart"
          FOREIGN KEY ("chartId") REFERENCES "game_charts"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_game_runs_user_createdAt"
        ON "game_runs" ("userId", "createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_game_runs_chart_score"
        ON "game_runs" ("chartId", "score" DESC)
        WHERE "validated" AND NOT "practiceMode"
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_run_tokens" (
        "id"           uuid PRIMARY KEY,
        "userId"       uuid NOT NULL,
        "chartId"      uuid NOT NULL,
        "chartHash"    character varying(64) NOT NULL,
        "practiceMode" boolean NOT NULL DEFAULT false,
        "issuedAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "expiresAt"    TIMESTAMP WITH TIME ZONE NOT NULL,
        "consumedAt"   TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "FK_game_run_tokens_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_run_tokens_chart"
          FOREIGN KEY ("chartId") REFERENCES "game_charts"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_game_run_tokens_expiresAt"
        ON "game_run_tokens" ("expiresAt")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_run_rejections" (
        "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"     uuid NOT NULL,
        "chartId"    uuid,
        "runTokenId" uuid,
        "reason"     character varying(32) NOT NULL,
        "detail"     jsonb NOT NULL DEFAULT '{}'::jsonb,
        "reviewedBy" uuid,
        "reviewedAt" TIMESTAMP WITH TIME ZONE,
        "action"     character varying(16),
        "createdAt"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_game_run_rejections_reason"
          CHECK ("reason" IN (
            'chart_hash_mismatch',
            'score_mismatch',
            'too_fast',
            'superhuman_consistency',
            'token_reused',
            'token_expired',
            'token_unknown',
            'malformed_input_log'
          )),
        CONSTRAINT "CHK_game_run_rejections_action"
          CHECK ("action" IS NULL OR "action" IN ('dismissed','voided','suspended')),
        CONSTRAINT "FK_game_run_rejections_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_run_rejections_chart"
          FOREIGN KEY ("chartId") REFERENCES "game_charts"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_game_run_rejections_reviewedBy"
          FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_game_run_rejections_pending"
        ON "game_run_rejections" ("createdAt" DESC)
        WHERE "reviewedAt" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_game_run_rejections_user"
        ON "game_run_rejections" ("userId", "createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_leaderboard_entries" (
        "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "chartId"    uuid NOT NULL,
        "userId"     uuid NOT NULL,
        "runId"      uuid NOT NULL,
        "score"      integer NOT NULL,
        "accuracy"   numeric(6,3) NOT NULL,
        "maxCombo"   integer NOT NULL DEFAULT 0,
        "rank"       character varying(2) NOT NULL,
        "achievedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "removedAt"  TIMESTAMP WITH TIME ZONE,
        "removedBy"  uuid,
        "removalReason" text,
        CONSTRAINT "FK_game_leaderboard_chart"
          FOREIGN KEY ("chartId") REFERENCES "game_charts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_leaderboard_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_leaderboard_run"
          FOREIGN KEY ("runId") REFERENCES "game_runs"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_game_leaderboard_removedBy"
          FOREIGN KEY ("removedBy") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_game_leaderboard_removal"
          CHECK (
            ("removedAt" IS NULL AND "removalReason" IS NULL)
            OR ("removedAt" IS NOT NULL AND "removalReason" IS NOT NULL)
          ),
        CONSTRAINT "UQ_game_leaderboard_chart_user" UNIQUE ("chartId", "userId")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_game_leaderboard_board"
        ON "game_leaderboard_entries" ("chartId", "score" DESC, "achievedAt")
        WHERE "removedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse dependency order: children before the tables they reference.
    await queryRunner.query(`DROP TABLE IF EXISTS "game_leaderboard_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_run_rejections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_run_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_runs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_user_settings"`);
  }
}
