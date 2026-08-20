import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Colourways as a variant dimension, per-colour imagery, and alt text.
 *
 * Mirrored in `sql/1787180000000-ProductColourways.sql`, which is the
 * reviewable record of what touches the database.
 *
 * A colourway used to require a whole second product with its own slug, which
 * split the reactions, comments and archive links of one garment across two
 * rows. Making colour part of the variant key keeps all of that on the piece
 * and still gives each colour its own stock, SKU and photographs.
 *
 * The buyable unit becomes `(productId, color, size)`. The cart follows: two
 * colourways of the same size are two lines, so its uniqueness moves from
 * (owner, product, size) onto (owner, variant), which is what it always
 * should have been once `variantId` existed.
 */
export class ProductColourways1787180000000 implements MigrationInterface {
  name = 'ProductColourways1787180000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "color" character varying(40) NOT NULL DEFAULT ''`,
    );
    // Swatch fill. Null means no swatch, and the picker shows the label.
    await queryRunner.query(
      `ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "colorHex" character varying(7)`,
    );
    // Empty falls back to the product's own images, so a single-colour
    // product needs nothing here.
    await queryRunner.query(
      `ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "images" text[] NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" DROP CONSTRAINT IF EXISTS "CHK_product_variants_color_hex"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" ADD CONSTRAINT "CHK_product_variants_color_hex" CHECK ("colorHex" IS NULL OR "colorHex" ~ '^#[0-9A-Fa-f]{6}$')`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_product_variants_product_size"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_variants_product_colour_size" ON "product_variants" ("productId", "color", "size")`,
    );

    // Index-aligned with `images`. A shorter array means the trailing photos
    // have no description yet — deliberately not a jsonb rewrite of `images`,
    // which every branch still reads as text[].
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "imageAlts" text[] NOT NULL DEFAULT '{}'`,
    );

    // Snapshot, for the same reason `size` and `productName` are snapshots.
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "color" character varying(40) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(`
      UPDATE "order_items" o
      SET "color" = v."color"
      FROM "product_variants" v
      WHERE v."id" = o."variantId" AND o."color" = ''
    `);

    // Backfill before the index swap: a row written before variants existed
    // has no variantId and would fall outside the new index entirely.
    await queryRunner.query(`
      UPDATE "cart_items" c
      SET "variantId" = v."id"
      FROM "product_variants" v
      WHERE v."productId" = c."productId"
        AND v."size" = c."size"
        AND v."color" = ''
        AND c."variantId" IS NULL
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_cart_items_user_product_size"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_cart_items_guest_product_size"`,
    );
    // Partial on `variantId IS NOT NULL` rather than a NOT NULL column: a row
    // the backfill could not resolve is abandoned, not worth deleting
    // someone's cart over, and it fails its own stock check regardless.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cart_items_user_variant" ON "cart_items" ("userId", "variantId") WHERE "userId" IS NOT NULL AND "variantId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cart_items_guest_variant" ON "cart_items" ("guestId", "variantId") WHERE "guestId" IS NOT NULL AND "variantId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_cart_items_guest_variant"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_cart_items_user_variant"`);

    // Reverting collapses colourways onto one row per size, so a product with
    // two colours in the same size would violate the old unique index. Keep
    // the first colour and retire the rest rather than fail the revert.
    await queryRunner.query(`
      UPDATE "product_variants" v
      SET "isActive" = false
      WHERE v."color" <> ''
        AND EXISTS (
          SELECT 1 FROM "product_variants" o
          WHERE o."productId" = v."productId"
            AND o."size" = v."size"
            AND (o."color" < v."color" OR o."color" = '')
        )
    `);
    await queryRunner.query(`
      DELETE FROM "product_variants" v
      WHERE v."color" <> ''
        AND v."isActive" = false
        AND NOT EXISTS (
          SELECT 1 FROM "order_items" o WHERE o."variantId" = v."id"
        )
        AND NOT EXISTS (
          SELECT 1 FROM "cart_items" c WHERE c."variantId" = v."id"
        )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cart_items_user_product_size" ON "cart_items" ("userId", "productId", "size") WHERE "userId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cart_items_guest_product_size" ON "cart_items" ("guestId", "productId", "size") WHERE "guestId" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "order_items" DROP COLUMN IF EXISTS "color"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN IF EXISTS "imageAlts"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_product_variants_product_colour_size"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_variants_product_size" ON "product_variants" ("productId", "size")`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" DROP CONSTRAINT IF EXISTS "CHK_product_variants_color_hex"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "images"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "colorHex"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "color"`,
    );
  }
}
