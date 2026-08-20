import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One row per buyable size.
 *
 * Mirrored in `sql/1787175000000-ProductVariants.sql`, which is the reviewable
 * record of what touches the database.
 *
 * Replaces `products.stockBySize` — a jsonb map that could hold a quantity and
 * nothing else. A real row per size carries a SKU and a price delta, and lets
 * other tables foreign-key to a specific size, which is what back-in-stock
 * alerts and per-size cart lines need.
 *
 * A product with no sizes still gets exactly one variant, with `size = ''`, so
 * every read path has one shape instead of branching on "does this have sizes".
 */
export class ProductVariants1787175000000 implements MigrationInterface {
  name = 'ProductVariants1787175000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_variants" (
        "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
        "productId"        uuid NOT NULL,
        "size"             character varying(20) NOT NULL DEFAULT '',
        "sku"              character varying(64),
        "stock"            integer NOT NULL DEFAULT 0,
        "priceDeltaCents"  integer NOT NULL DEFAULT 0,
        "position"         double precision NOT NULL DEFAULT 0,
        "isActive"         boolean NOT NULL DEFAULT true,
        "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_variants" PRIMARY KEY ("id"),
        CONSTRAINT "FK_product_variants_product"
          FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_product_variants_stock" CHECK ("stock" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_variants_product_size" ON "product_variants" ("productId", "size")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_variants_sku" ON "product_variants" ("sku") WHERE "sku" IS NOT NULL`,
    );

    // Sized products: one row per entry in the sizes array, keeping the
    // admin's chosen order as `position`.
    await queryRunner.query(`
      INSERT INTO "product_variants" ("productId", "size", "stock", "position")
      SELECT p."id",
             s."size",
             GREATEST(COALESCE((p."stockBySize" ->> s."size")::int, 0), 0),
             s."ord"
      FROM "products" p
      CROSS JOIN LATERAL unnest(p."sizes") WITH ORDINALITY AS s("size", "ord")
      WHERE COALESCE(array_length(p."sizes", 1), 0) > 0
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "product_variants" ("productId", "size", "stock", "position")
      SELECT p."id", '', GREATEST(p."stock", 0), 0
      FROM "products" p
      WHERE COALESCE(array_length(p."sizes", 1), 0) = 0
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(
      `ALTER TABLE "cart_items" ADD COLUMN IF NOT EXISTS "variantId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "variantId" uuid`,
    );
    await queryRunner.query(`
      UPDATE "cart_items" c SET "variantId" = v."id"
      FROM "product_variants" v
      WHERE v."productId" = c."productId" AND v."size" = c."size"
        AND c."variantId" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "order_items" o SET "variantId" = v."id"
      FROM "product_variants" v
      WHERE v."productId" = o."productId" AND v."size" = o."size"
        AND o."variantId" IS NULL
    `);

    // A cart line for a variant that no longer exists is meaningless.
    await queryRunner.query(
      `ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "FK_cart_items_variant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" ADD CONSTRAINT "FK_cart_items_variant" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE`,
    );
    // Order history must survive a variant being deleted, so the link is
    // severed rather than the row — `order_items.size` is already a snapshot
    // for exactly this reason, like `productName`.
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "FK_order_items_variant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_order_items_variant" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cart_items_variantId" ON "cart_items" ("variantId") WHERE "variantId" IS NOT NULL`,
    );

    // Variants are the only stock of record from here on. `products.stock`
    // stays as a maintained total, because browsing sorts and filters on it.
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN IF EXISTS "stockBySize"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "stockBySize" jsonb NOT NULL DEFAULT '{}'`,
    );
    // Rebuild the map from the rows that replaced it, so a revert keeps the
    // quantities rather than resetting every product to zero.
    await queryRunner.query(`
      UPDATE "products" p
      SET "stockBySize" = COALESCE(m."map", '{}'::jsonb)
      FROM (
        SELECT "productId", jsonb_object_agg("size", "stock") AS "map"
        FROM "product_variants"
        WHERE "size" <> ''
        GROUP BY "productId"
      ) m
      WHERE m."productId" = p."id"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cart_items_variantId"`);
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "FK_order_items_variant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "FK_cart_items_variant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP COLUMN IF EXISTS "variantId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_items" DROP COLUMN IF EXISTS "variantId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "product_variants"`);
  }
}
