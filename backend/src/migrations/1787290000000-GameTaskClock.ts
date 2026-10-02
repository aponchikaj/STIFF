import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The task loop: a task is drawn for a player, accepted, and put on a clock.
 *
 * Additive throughout — one new table, one nullable column, one CHECK
 * widened — so every branch keeps working against the shared database.
 *
 * **`game_task_assignments`** is where the hearts rule lives. A decline burns
 * a heart; a clock that reaches zero burns a heart; the last heart makes the
 * player a watcher. `UQ_game_task_assignments_enrolment_template` is what
 * makes "once per player per season" a fact — a declined task does not come
 * round again and a finished one cannot be farmed. `clockMinutes` is copied
 * from the template so a pool edit cannot move a clock already running.
 *
 * **`game_attempts.assignmentId`** ties a hand-in to the assignment it closes.
 * Nullable so rows from before this migration stay valid.
 *
 * **`CHK_game_enrolments_demotion`** gains `out_of_hearts`.
 */
export class GameTaskClock1787290000000 implements MigrationInterface {
  name = 'GameTaskClock1787290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_task_assignments" (
        "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "seasonId"       uuid NOT NULL,
        "enrolmentId"    uuid NOT NULL,
        "taskTemplateId" uuid NOT NULL,
        "day"            smallint NOT NULL,
        "status"         character varying(16) NOT NULL DEFAULT 'offered',
        "clockMinutes"   integer NOT NULL,
        "acceptedAt"     TIMESTAMP WITH TIME ZONE,
        "expiresAt"      TIMESTAMP WITH TIME ZONE,
        "resolvedAt"     TIMESTAMP WITH TIME ZONE,
        "attemptId"      uuid,
        "heartBurned"    boolean NOT NULL DEFAULT false,
        "createdAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_game_task_assignments_enrolment_template"
          UNIQUE ("enrolmentId", "taskTemplateId"),
        CONSTRAINT "CHK_game_task_assignments_day" CHECK ("day" BETWEEN 1 AND 3),
        CONSTRAINT "CHK_game_task_assignments_status"
          CHECK ("status" IN ('offered', 'accepted', 'declined', 'submitted', 'expired')),
        CONSTRAINT "CHK_game_task_assignments_clock" CHECK ("clockMinutes" > 0),
        -- An accepted task has a clock; an offered one does not yet.
        CONSTRAINT "CHK_game_task_assignments_timing" CHECK (
          ("status" = 'offered' AND "acceptedAt" IS NULL AND "expiresAt" IS NULL)
          OR ("status" <> 'offered' AND ("acceptedAt" IS NULL) = ("expiresAt" IS NULL))
        ),
        CONSTRAINT "FK_game_task_assignments_season"
          FOREIGN KEY ("seasonId") REFERENCES "game_seasons"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_task_assignments_enrolment"
          FOREIGN KEY ("enrolmentId") REFERENCES "game_enrolments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_task_assignments_template"
          FOREIGN KEY ("taskTemplateId") REFERENCES "game_task_templates"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_task_assignments_enrolment_status" ON "game_task_assignments" ("enrolmentId", "status")`,
    );
    // The clock sweep runs every minute over "accepted and overdue".
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_task_assignments_status_expires" ON "game_task_assignments" ("status", "expiresAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_task_assignments_season" ON "game_task_assignments" ("seasonId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_task_assignments_template" ON "game_task_assignments" ("taskTemplateId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "game_attempts" ADD COLUMN IF NOT EXISTS "assignmentId" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_attempts_assignment" ON "game_attempts" ("assignmentId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "game_enrolments" DROP CONSTRAINT IF EXISTS "CHK_game_enrolments_demotion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_enrolments" ADD CONSTRAINT "CHK_game_enrolments_demotion" CHECK (
         ("status" = 'active' AND "demotionReason" IS NULL AND "demotedAt" IS NULL)
         OR ("status" <> 'active'
             AND "demotionReason" IN ('cheating', 'missed_daily_minimum', 'zero_balance', 'out_of_hearts')
             AND "demotedAt" IS NOT NULL)
       )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "game_enrolments" DROP CONSTRAINT IF EXISTS "CHK_game_enrolments_demotion"`,
    );
    // Fails if any row was demoted for running out of hearts. Correct: that
    // history exists and a migration should not rewrite it.
    await queryRunner.query(
      `ALTER TABLE "game_enrolments" ADD CONSTRAINT "CHK_game_enrolments_demotion" CHECK (
         ("status" = 'active' AND "demotionReason" IS NULL AND "demotedAt" IS NULL)
         OR ("status" <> 'active'
             AND "demotionReason" IN ('cheating', 'missed_daily_minimum', 'zero_balance')
             AND "demotedAt" IS NOT NULL)
       )`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_game_attempts_assignment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_attempts" DROP COLUMN IF EXISTS "assignmentId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "game_task_assignments"`);
  }
}
