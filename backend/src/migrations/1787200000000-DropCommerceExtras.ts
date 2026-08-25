import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Retires the commerce extras: promotions, returns, pre-orders, fit ratings,
 * stock alerts.
 *
 * Mirrored in `sql/1787200000000-DropCommerceExtras.sql`.
 *
 * Forwards rather than a revert of the migrations that built these, because
 * those are already recorded as run on every environment sharing this
 * database — reverting them there would leave the migration history
 * disagreeing with itself.
 *
 * Safe only because the code reading these tables and columns is removed on
 * every branch in the same change. Dropping something a deployed branch still
 * selects from is the one thing this shared database cannot survive, which is
 * why the two go together.
 */
export class DropCommerceExtras1787200000000 implements MigrationInterface {
  name = 'DropCommerceExtras1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Child tables first — the foreign keys go with them.
    await queryRunner.query(`DROP TABLE IF EXISTS "return_request_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "return_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "discount_redemptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gift_card_ledger"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "discount_codes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gift_cards"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_fit_ratings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_alerts"`);

    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN IF EXISTS "discountCode",
        DROP COLUMN IF EXISTS "discountCents",
        DROP COLUMN IF EXISTS "giftCardCode",
        DROP COLUMN IF EXISTS "giftCardCents"
    `);
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP COLUMN IF EXISTS "isPreorder"`,
    );
    await queryRunner.query(`
      ALTER TABLE "products"
        DROP COLUMN IF EXISTS "preorderEnabled",
        DROP COLUMN IF EXISTS "preorderShipsAt",
        DROP COLUMN IF EXISTS "preorderLimit",
        DROP COLUMN IF EXISTS "fitSmallCount",
        DROP COLUMN IF EXISTS "fitTrueCount",
        DROP COLUMN IF EXISTS "fitLargeCount"
    `);
    await queryRunner.query(
      `ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "preorderedCount"`,
    );
  }

  /**
   * Restores the shapes, empty.
   *
   * What was in these is not recoverable from here — a down migration can
   * restore a shape, never the rows. The dump taken before this ran is the
   * only way back to the contents.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "product_variants"
        ADD COLUMN IF NOT EXISTS "preorderedCount" int NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "preorderEnabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "preorderShipsAt" date,
        ADD COLUMN IF NOT EXISTS "preorderLimit" int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "fitSmallCount" int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "fitTrueCount" int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "fitLargeCount" int NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "order_items"
        ADD COLUMN IF NOT EXISTS "isPreorder" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "discountCode" varchar(40),
        ADD COLUMN IF NOT EXISTS "discountCents" int NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "giftCardCode" varchar(40),
        ADD COLUMN IF NOT EXISTS "giftCardCents" int NOT NULL DEFAULT 0
    `);
    // The dropped tables are not recreated: their shapes live in the
    // migrations that built them, and restoring them without their rows would
    // be a shape nothing reads. Use the dump.
  }
}
