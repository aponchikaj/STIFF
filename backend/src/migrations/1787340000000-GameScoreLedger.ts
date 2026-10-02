import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The score gets a ledger.
 *
 * Additive throughout, so every branch keeps working against the shared
 * database: one new table nothing older reads.
 *
 * **`game_score_ledger`.** Every point of Nerve that moves, with the score
 * after it, why, for what, and by whom. `game_enrolments.nerve` stays the
 * running total the board reads; from here on it is derived from these rows,
 * written in the same transaction. An enrolment that already had Nerve gets
 * one `opening` row for it, so the sum matches from the first day.
 *
 * The board's index, `IDX_game_enrolments_board` on
 * `("seasonId", "role", "nerve" DESC)`, already exists from
 * `GameSeasonsAndFeed1787250000000` and serves the ordering here; the
 * tie-break columns after it are a sort within equal scores, not a scan.
 */
export class GameScoreLedger1787340000000 implements MigrationInterface {
  name = 'GameScoreLedger1787340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_score_ledger" (
        "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "enrolmentId" uuid NOT NULL,
        "delta"       integer NOT NULL,
        "scoreAfter"  integer NOT NULL,
        "reason"      character varying(24) NOT NULL,
        "refType"     character varying(24),
        "refId"       uuid,
        "by"          character varying(40),
        "createdAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_game_score_ledger_reason"
          CHECK ("reason" IN ('task_reward', 'clawback', 'cheating', 'reinstated', 'admin', 'opening')),
        CONSTRAINT "CHK_game_score_ledger_delta" CHECK ("delta" <> 0),
        CONSTRAINT "CHK_game_score_ledger_score_after" CHECK ("scoreAfter" >= 0),
        CONSTRAINT "FK_game_score_ledger_enrolment"
          FOREIGN KEY ("enrolmentId") REFERENCES "game_enrolments"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_score_ledger_enrolment_created" ON "game_score_ledger" ("enrolmentId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_score_ledger_enrolment" ON "game_score_ledger" ("enrolmentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_score_ledger_ref" ON "game_score_ledger" ("refType", "refId")`,
    );

    // Whatever Nerve exists already becomes the opening row, once, so the
    // ledger's sum equals the score for every enrolment from the start.
    await queryRunner.query(`
      INSERT INTO "game_score_ledger" ("enrolmentId", "delta", "scoreAfter", "reason", "refType", "by")
      SELECT e."id", e."nerve", e."nerve", 'opening', 'migration', 'migration'
        FROM "game_enrolments" e
       WHERE e."nerve" > 0
         AND NOT EXISTS (SELECT 1 FROM "game_score_ledger" l WHERE l."enrolmentId" = e."id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "game_score_ledger"`);
  }
}
