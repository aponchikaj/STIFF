import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-size inventory, Tbilisi shipping + payment placeholders, and a packed
 * step on the order board. Existing stock is parked on the first size so
 * totals stay the same until an admin redistributes.
 */
export class CheckoutStockShipping1786741000000 implements MigrationInterface {
  name = 'CheckoutStockShipping1786741000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD "stockBySize" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(`
      UPDATE "products"
      SET "stockBySize" = jsonb_build_object("sizes"[1], "stock")
      WHERE cardinality("sizes") > 0
    `);

    await queryRunner.query(
      `ALTER TYPE "orders_status_enum" ADD VALUE IF NOT EXISTS 'packed'`,
    );

    await queryRunner.query(
      `ALTER TABLE "orders" ADD "paymentMethod" character varying(20) NOT NULL DEFAULT 'cod'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "shippingMethod" character varying(20) NOT NULL DEFAULT 'tbilisi'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "shippingCents" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'gel'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'usd'`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "shippingCents"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "shippingMethod"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "paymentMethod"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "stockBySize"`);
  }
}
