import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Scheduled drops, and taking orders against stock not yet made.
 *
 * Mirrored in `sql/1787179000000-Preorders.sql`, which is the reviewable
 * record of what touches the database.
 *
 * Two things a drop brand needs that the shop could not do: publish at a set
 * moment without someone staying up for it, and accept orders for a piece that
 * does not physically exist yet.
 */
export class Preorders1787179000000 implements MigrationInterface {
  name = 'Preorders1787179000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [column, type] of [
      ['publishAt', 'TIMESTAMP WITH TIME ZONE'],
      ['preorderEnabled', 'boolean NOT NULL DEFAULT false'],
      ['preorderShipsAt', 'date'],
      ['preorderLimit', 'integer NOT NULL DEFAULT 0'],
    ]) {
      await queryRunner.query(
        `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "${column}" ${type}`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "CHK_products_preorder_limit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "CHK_products_preorder_limit" CHECK ("preorderLimit" >= 0)`,
    );

    await queryRunner.query(
      `ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "preorderedCount" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" DROP CONSTRAINT IF EXISTS "CHK_product_variants_preordered"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" ADD CONSTRAINT "CHK_product_variants_preordered" CHECK ("preorderedCount" >= 0)`,
    );

    await queryRunner.query(
      `ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "isPreorder" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_products_publishAt" ON "products" ("publishAt") WHERE "publishAt" IS NOT NULL AND NOT "isActive"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_publishAt"`);
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP COLUMN IF EXISTS "isPreorder"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" DROP CONSTRAINT IF EXISTS "CHK_product_variants_preordered"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "preorderedCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "CHK_products_preorder_limit"`,
    );
    for (const column of [
      'preorderLimit',
      'preorderShipsAt',
      'preorderEnabled',
      'publishAt',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "products" DROP COLUMN IF EXISTS "${column}"`,
      );
    }
  }
}
