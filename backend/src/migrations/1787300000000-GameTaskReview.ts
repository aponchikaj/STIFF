import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two agents write the pool now — a creator and a reviewer — and the pool
 * records what each said.
 *
 * Additive throughout.
 *
 * **`game_task_templates.proof`** — how a task is proved: `photo`, `video` or
 * `either`. Stated in the brief and enforced when a player opens an upload.
 * Existing rows default to `either`, which is what they were in practice.
 *
 * **`game_task_templates.review`** — the reviewer agent's verdict on the row,
 * so an approver sees it and a rejected task cannot be approved unreviewed.
 *
 * **`game_generation_rejections.source` / `feedback` / `round`** — which
 * agent refused a draft, what the creator was told, and which turn of the
 * loop it was. Existing rows were all the screen's, on round one.
 */
export class GameTaskReview1787300000000 implements MigrationInterface {
  name = 'GameTaskReview1787300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "game_task_templates"
         ADD COLUMN IF NOT EXISTS "proof" character varying(8) NOT NULL DEFAULT 'either',
         ADD COLUMN IF NOT EXISTS "review" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_task_templates" DROP CONSTRAINT IF EXISTS "CHK_game_task_templates_proof"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_task_templates" ADD CONSTRAINT "CHK_game_task_templates_proof"
         CHECK ("proof" IN ('photo', 'video', 'either'))`,
    );

    await queryRunner.query(
      `ALTER TABLE "game_generation_rejections"
         ADD COLUMN IF NOT EXISTS "source" character varying(16) NOT NULL DEFAULT 'screen',
         ADD COLUMN IF NOT EXISTS "feedback" text,
         ADD COLUMN IF NOT EXISTS "round" smallint NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_generation_rejections" DROP CONSTRAINT IF EXISTS "CHK_game_generation_rejections_source"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_generation_rejections" ADD CONSTRAINT "CHK_game_generation_rejections_source"
         CHECK ("source" IN ('screen', 'reviewer'))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_generation_rejections_source" ON "game_generation_rejections" ("source")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_game_generation_rejections_source"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_generation_rejections" DROP CONSTRAINT IF EXISTS "CHK_game_generation_rejections_source"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_generation_rejections"
         DROP COLUMN IF EXISTS "round",
         DROP COLUMN IF EXISTS "feedback",
         DROP COLUMN IF EXISTS "source"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_task_templates" DROP CONSTRAINT IF EXISTS "CHK_game_task_templates_proof"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_task_templates"
         DROP COLUMN IF EXISTS "review",
         DROP COLUMN IF EXISTS "proof"`,
    );
  }
}
