import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The task pool, and the record of what the safety screen refused.
 *
 * Purely additive — two new tables, nothing altered or dropped — so branches
 * without `src/game/` keep working against the same shared database.
 *
 * **`game_task_templates`** is the pool the game hands out from. Pool-wide
 * rather than season-scoped: a task that worked is worth running again, and
 * scoping it to a season would mean rewriting the whole set every time one
 * starts. A generated template lands as `draft` and only a person moves it to
 * `approved`, which `CHK_game_task_templates_approval` makes structural — an
 * approved row without an approver is rejected by the database, not merely
 * discouraged by the service.
 *
 * **`game_generation_rejections`** is why rejecting is useful rather than just
 * safe. A rejection rate that climbs after a Charter edit is the first sign the
 * edit stopped holding; a rate that sits at zero across hundreds of
 * generations usually means the screen was weakened rather than that the model
 * improved. Neither is visible if rejections only ever exist in an HTTP
 * response. Append-only by intent, like `admin_audit_logs` — there is no
 * endpoint that edits or deletes a row.
 *
 * `charterHash` on both sides is what makes "which live tasks predate the
 * current safety rules" a query rather than an archaeology project.
 */
export class GameTaskPool1787260000000 implements MigrationInterface {
  name = 'GameTaskPool1787260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_task_templates" (
        "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug"         character varying(80) NOT NULL,
        "tier"         smallint NOT NULL,
        "title"        character varying(120) NOT NULL,
        "brief"        text NOT NULL,
        "clockMinutes" integer NOT NULL,
        "guards"       jsonb NOT NULL DEFAULT '[]',
        "criteria"     jsonb NOT NULL DEFAULT '[]',
        "rationale"    text,
        "status"       character varying(16) NOT NULL DEFAULT 'draft',
        "origin"       character varying(16) NOT NULL DEFAULT 'human',
        "charterHash"  character varying(16),
        "model"        character varying(40),
        "approvedAt"   TIMESTAMP WITH TIME ZONE,
        "approvedBy"   uuid,
        "createdAt"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_game_task_templates_slug" UNIQUE ("slug"),
        CONSTRAINT "CHK_game_task_templates_tier" CHECK ("tier" BETWEEN 1 AND 3),
        CONSTRAINT "CHK_game_task_templates_status"
          CHECK ("status" IN ('draft', 'approved', 'retired')),
        CONSTRAINT "CHK_game_task_templates_origin"
          CHECK ("origin" IN ('human', 'generated')),
        -- An approved task always has an approver and a timestamp. Nothing
        -- reaches a player because a model wrote it; a person has to say so,
        -- and the database is where that stops being a convention.
        CONSTRAINT "CHK_game_task_templates_approval" CHECK (
          "status" <> 'approved'
          OR ("approvedAt" IS NOT NULL AND "approvedBy" IS NOT NULL)
        ),
        -- A generated task records the Charter that wrote it. Without this a
        -- row could claim rules it was never given.
        CONSTRAINT "CHK_game_task_templates_provenance" CHECK (
          "origin" <> 'generated' OR "charterHash" IS NOT NULL
        ),
        CONSTRAINT "FK_game_task_templates_approver"
          FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    // The review queue reads drafts by tier; the round reads approved by tier.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_task_templates_status_tier" ON "game_task_templates" ("status", "tier")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_task_templates_charter" ON "game_task_templates" ("charterHash")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_generation_rejections" (
        "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "charterHash" character varying(16) NOT NULL,
        "model"       character varying(40) NOT NULL,
        "tier"        smallint NOT NULL,
        "slug"        character varying(80) NOT NULL,
        "brief"       text NOT NULL,
        "categories"  jsonb NOT NULL,
        "violations"  jsonb NOT NULL,
        "createdAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    // "Rejection rate for this Charter, over time" is the question this table
    // exists to answer, so it is the index it gets.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_generation_rejections_charter" ON "game_generation_rejections" ("charterHash", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_generation_rejections_categories" ON "game_generation_rejections" USING GIN ("categories")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "game_generation_rejections"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "game_task_templates"`);
  }
}
