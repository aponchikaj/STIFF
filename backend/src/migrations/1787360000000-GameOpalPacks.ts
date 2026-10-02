import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Opals for money.
 *
 * Additive throughout — two new tables, two defaulted columns, a widened
 * CHECK — so every branch keeps working against the shared database before
 * it has the code that reads any of it.
 *
 * **Packs.** `game_opal_packs` is the price list an admin edits from the
 * game panel: opals for tetri, draft/live/archived. Nothing is seeded;
 * nothing is on sale until someone publishes a pack.
 *
 * **Orders.** `game_opal_orders` is one row per attempt to buy, created
 * `pending` before the acquirer is contacted, with the pack's name, opals
 * and price snapshotted. Only the pending → paid transition credits.
 *
 * **Carry-over.** Bought opals sit on the season balance like earned ones
 * but outlive the season. `game_enrolments.paidOpals` is how many were
 * bought into that enrolment; `opalsCarriedAt` marks it carried from.
 *
 * The ledger's reason CHECK is widened for `opal_topup` and `opal_carry`.
 */
export class GameOpalPacks1787360000000 implements MigrationInterface {
  name = 'GameOpalPacks1787360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_opal_packs" (
        "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"       character varying(60) NOT NULL,
        "opals"      integer NOT NULL,
        "priceCents" integer NOT NULL,
        "badge"      character varying(24),
        "status"     character varying(12) NOT NULL DEFAULT 'draft',
        "sortOrder"  integer NOT NULL DEFAULT 0,
        "createdBy"  uuid,
        "createdAt"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_game_opal_packs_status" CHECK ("status" IN ('draft', 'live', 'archived')),
        CONSTRAINT "CHK_game_opal_packs_opals" CHECK ("opals" >= 1),
        CONSTRAINT "CHK_game_opal_packs_price" CHECK ("priceCents" >= 1)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_opal_packs_status_sort" ON "game_opal_packs" ("status", "sortOrder")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_opal_orders" (
        "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"        uuid NOT NULL,
        "enrolmentId"   uuid,
        "packId"        uuid,
        "packName"      character varying(60) NOT NULL,
        "opals"         integer NOT NULL,
        "priceCents"    integer NOT NULL,
        "paymentMethod" character varying(16) NOT NULL,
        "status"        character varying(12) NOT NULL DEFAULT 'pending',
        "reference"     character varying(120),
        "testMode"      boolean NOT NULL DEFAULT false,
        "paidAt"        TIMESTAMP WITH TIME ZONE,
        "createdAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_game_opal_orders_status" CHECK ("status" IN ('pending', 'paid', 'failed')),
        CONSTRAINT "CHK_game_opal_orders_method" CHECK ("paymentMethod" IN ('card_tbc', 'card_bog')),
        CONSTRAINT "CHK_game_opal_orders_opals" CHECK ("opals" >= 1),
        CONSTRAINT "CHK_game_opal_orders_price" CHECK ("priceCents" >= 1),
        CONSTRAINT "FK_game_opal_orders_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_opal_orders_enrolment"
          FOREIGN KEY ("enrolmentId") REFERENCES "game_enrolments"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_game_opal_orders_pack"
          FOREIGN KEY ("packId") REFERENCES "game_opal_packs"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_opal_orders_user_created" ON "game_opal_orders" ("userId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_opal_orders_status_created" ON "game_opal_orders" ("status", "createdAt")`,
    );
    // A reference identifies one payment; two orders claiming it is a bug.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_game_opal_orders_reference" ON "game_opal_orders" ("reference") WHERE "reference" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_opal_orders_enrolment" ON "game_opal_orders" ("enrolmentId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "game_enrolments"
         ADD COLUMN IF NOT EXISTS "paidOpals" integer NOT NULL DEFAULT 0,
         ADD COLUMN IF NOT EXISTS "opalsCarriedAt" TIMESTAMP WITH TIME ZONE`,
    );
    // Carry-over asks "this account's enrolments still holding bought opals".
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_enrolments_paid_opals" ON "game_enrolments" ("userId")
         WHERE "paidOpals" > 0 AND "opalsCarriedAt" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "game_coin_ledger" DROP CONSTRAINT IF EXISTS "CHK_game_coin_ledger_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_coin_ledger" ADD CONSTRAINT "CHK_game_coin_ledger_reason"
         CHECK ("reason" IN ('task_reward', 'task_penalty', 'vote_reward', 'purchase',
                             'cheating', 'reinstated', 'admin',
                             'war_stake', 'war_payout', 'war_refund',
                             'opal_topup', 'opal_carry'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Fails if any opal row exists in the coin ledger. Correct: those are
    // opals somebody paid money for, and a migration should not erase that.
    await queryRunner.query(
      `ALTER TABLE "game_coin_ledger" DROP CONSTRAINT IF EXISTS "CHK_game_coin_ledger_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_coin_ledger" ADD CONSTRAINT "CHK_game_coin_ledger_reason"
         CHECK ("reason" IN ('task_reward', 'task_penalty', 'vote_reward', 'purchase',
                             'cheating', 'reinstated', 'admin',
                             'war_stake', 'war_payout', 'war_refund'))`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_game_enrolments_paid_opals"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_enrolments"
         DROP COLUMN IF EXISTS "opalsCarriedAt",
         DROP COLUMN IF EXISTS "paidOpals"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "game_opal_orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_opal_packs"`);
  }
}
