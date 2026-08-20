import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Let people fill a cart and order without an account.
 *
 * Mirrored in `sql/1787174000000-GuestCheckout.sql`, which is the reviewable
 * record of what touches the database.
 *
 * A cart row belongs to exactly one owner — a signed-in user or an anonymous
 * browser holding the `stiff_cart` cookie. That is enforced by a CHECK rather
 * than left to the service layer, because a half-owned cart row is the kind of
 * bug that only shows up as someone else's items in your cart.
 */
export class GuestCheckout1787174000000 implements MigrationInterface {
  name = 'GuestCheckout1787174000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cart_items" ALTER COLUMN "userId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" ADD COLUMN IF NOT EXISTS "guestId" character varying(64)`,
    );

    // Spans a now-nullable column, so it can no longer do the job alone:
    // Postgres treats NULLs as distinct in a UNIQUE constraint.
    await queryRunner.query(
      `ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "UQ_678f7fdd2b61c01a1316eacabf7"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cart_items_user_product_size" ON "cart_items" ("userId", "productId", "size") WHERE "userId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cart_items_guest_product_size" ON "cart_items" ("guestId", "productId", "size") WHERE "guestId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cart_items_guestId" ON "cart_items" ("guestId") WHERE "guestId" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "CHK_cart_items_one_owner"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" ADD CONSTRAINT "CHK_cart_items_one_owner" CHECK (("userId" IS NOT NULL) <> ("guestId" IS NOT NULL))`,
    );

    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "guestEmail" character varying(180)`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "CHK_orders_reachable"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "CHK_orders_reachable" CHECK ("userId" IS NOT NULL OR "guestEmail" IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_orders_guestEmail" ON "orders" ("guestEmail") WHERE "guestEmail" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_guestEmail"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "CHK_orders_reachable"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "guestEmail"`,
    );

    await queryRunner.query(
      `ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "CHK_cart_items_one_owner"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cart_items_guestId"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_cart_items_guest_product_size"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_cart_items_user_product_size"`,
    );
    // Guest rows cannot satisfy the restored NOT NULL, so clear them first.
    await queryRunner.query(
      `DELETE FROM "cart_items" WHERE "guestId" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" DROP COLUMN IF EXISTS "guestId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" ALTER COLUMN "userId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" ADD CONSTRAINT "UQ_678f7fdd2b61c01a1316eacabf7" UNIQUE ("userId", "productId", "size")`,
    );
  }
}
