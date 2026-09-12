import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The rules that move a player to watcher, and the sign-up that needs less.
 *
 * Four changes, and one of them is not purely additive — read that one before
 * the rest.
 *
 * **`game_attempts` loses `UQ_game_attempts_enrolment_day`.** A player now
 * hands in as many tasks a day as they like and must hand in at least four,
 * so one-row-per-day is no longer the shape. This is the change a branch
 * without the new code cannot survive: the old `requestUpload` reserves a day
 * with `ON CONFLICT ("enrolmentId", "day")`, and Postgres refuses that clause
 * the moment no unique index matches it. So this migration and the code that
 * goes with it must reach every deployed branch together — merge `main` into
 * `staff`, `admin`, `stage` and `pre-prod` in the same sitting as deploying
 * it, not next week. Everything else here is additive.
 *
 * **`game_attempts` gains `submittedAt`, `taskTemplateId`, `aiVerdict`,
 * `aiCheckedAt`, `rejectionReason`.** `submittedAt` is the timestamp the daily
 * minimum counts — the confirm, not the reservation — and is backfilled from
 * `updatedAt` for rows already handed in, which is the best evidence of when
 * that happened. `aiVerdict` is what the cheat detector concluded, kept on the
 * row so a reviewer sees what the model saw.
 *
 * **`game_enrolments` gains `status`, `demotedAt`, `demotionReason`,
 * `demotionSnapshot`.** Every existing row is `active`. `demotionSnapshot`
 * holds what was zeroed so a wrong call can be undone from the panel.
 *
 * **`users.email` becomes nullable and `users.birthDate` is added.** The
 * game's sign-up is a username, a password and a side; the game is 16+ and
 * asks for a date of birth. The unique index on `email` stays — Postgres
 * treats nulls as distinct there, so any number of email-less accounts is
 * fine and two accounts with the same address still is not.
 */
export class GameDiscipline1787280000000 implements MigrationInterface {
  name = 'GameDiscipline1787280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------- users --
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birthDate" date`,
    );

    // --------------------------------------------------- game_enrolments --
    await queryRunner.query(
      `ALTER TABLE "game_enrolments"
         ADD COLUMN IF NOT EXISTS "status" character varying(16) NOT NULL DEFAULT 'active',
         ADD COLUMN IF NOT EXISTS "demotedAt" TIMESTAMP WITH TIME ZONE,
         ADD COLUMN IF NOT EXISTS "demotionReason" character varying(32),
         ADD COLUMN IF NOT EXISTS "demotionSnapshot" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_enrolments" DROP CONSTRAINT IF EXISTS "CHK_game_enrolments_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_enrolments" ADD CONSTRAINT "CHK_game_enrolments_status"
         CHECK ("status" IN ('active', 'demoted', 'cheater'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_enrolments" DROP CONSTRAINT IF EXISTS "CHK_game_enrolments_demotion"`,
    );
    // A demotion has a reason and a time, and an active row has neither.
    // Held in the database so no writer can leave a watcher who was a player
    // with nothing on record about why.
    await queryRunner.query(
      `ALTER TABLE "game_enrolments" ADD CONSTRAINT "CHK_game_enrolments_demotion" CHECK (
         ("status" = 'active' AND "demotionReason" IS NULL AND "demotedAt" IS NULL)
         OR ("status" <> 'active'
             AND "demotionReason" IN ('cheating', 'missed_daily_minimum', 'zero_balance')
             AND "demotedAt" IS NOT NULL)
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_enrolments_season_status" ON "game_enrolments" ("seasonId", "status")`,
    );

    // ------------------------------------------------------ game_attempts --
    // Read the file comment before touching this line.
    await queryRunner.query(
      `ALTER TABLE "game_attempts" DROP CONSTRAINT IF EXISTS "UQ_game_attempts_enrolment_day"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_attempts"
         ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP WITH TIME ZONE,
         ADD COLUMN IF NOT EXISTS "taskTemplateId" uuid,
         ADD COLUMN IF NOT EXISTS "aiVerdict" jsonb,
         ADD COLUMN IF NOT EXISTS "aiCheckedAt" TIMESTAMP WITH TIME ZONE,
         ADD COLUMN IF NOT EXISTS "rejectionReason" character varying(500)`,
    );
    await queryRunner.query(
      `UPDATE "game_attempts"
          SET "submittedAt" = "updatedAt"
        WHERE "submittedAt" IS NULL
          AND "status" IN ('submitted', 'published', 'rejected')`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_attempts" DROP CONSTRAINT IF EXISTS "FK_game_attempts_task_template"`,
    );
    // SET NULL, not CASCADE: retiring or deleting a task must not take the
    // proof people handed in for it out of the feed.
    await queryRunner.query(
      `ALTER TABLE "game_attempts" ADD CONSTRAINT "FK_game_attempts_task_template"
         FOREIGN KEY ("taskTemplateId") REFERENCES "game_task_templates"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_attempts_task_template" ON "game_attempts" ("taskTemplateId")`,
    );
    // The nightly sweep asks "how many did this enrolment hand in between
    // these two times"; this is the index that answers it.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_attempts_enrolment_submitted" ON "game_attempts" ("enrolmentId", "submittedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_game_attempts_enrolment_submitted"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_game_attempts_task_template"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_attempts" DROP CONSTRAINT IF EXISTS "FK_game_attempts_task_template"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_attempts"
         DROP COLUMN IF EXISTS "rejectionReason",
         DROP COLUMN IF EXISTS "aiCheckedAt",
         DROP COLUMN IF EXISTS "aiVerdict",
         DROP COLUMN IF EXISTS "taskTemplateId",
         DROP COLUMN IF EXISTS "submittedAt"`,
    );
    // Only restorable if no enrolment has more than one attempt per day. If
    // one does, this fails, and that is the right outcome: the data no longer
    // fits the old rule and a person has to decide what to do with it.
    await queryRunner.query(
      `ALTER TABLE "game_attempts" ADD CONSTRAINT "UQ_game_attempts_enrolment_day" UNIQUE ("enrolmentId", "day")`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_game_enrolments_season_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_enrolments" DROP CONSTRAINT IF EXISTS "CHK_game_enrolments_demotion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_enrolments" DROP CONSTRAINT IF EXISTS "CHK_game_enrolments_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_enrolments"
         DROP COLUMN IF EXISTS "demotionSnapshot",
         DROP COLUMN IF EXISTS "demotionReason",
         DROP COLUMN IF EXISTS "demotedAt",
         DROP COLUMN IF EXISTS "status"`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "birthDate"`,
    );
    // Fails if any account has no email. Again: correct. Those accounts exist
    // and deleting or inventing an address for them is not a migration's call.
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`,
    );
  }
}
