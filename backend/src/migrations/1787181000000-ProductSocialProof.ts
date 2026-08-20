import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ties the two halves of the site together, and lets buyers report fit.
 *
 * Mirrored in `sql/1787181000000-ProductSocialProof.sql`, which is the
 * reviewable record of what touches the database.
 *
 * Two things the product page could not say before:
 *
 * - Which archive shots feature this piece. The gallery and the shop have
 *   been separate worlds; the link is many-to-many because one photograph can
 *   show several pieces and one piece appears in several photographs.
 * - How it fits. Reactions are binary and stars average into nothing —
 *   "runs small / true / runs large" is the question people actually ask, and
 *   only someone who bought it can answer.
 */
export class ProductSocialProof1787181000000 implements MigrationInterface {
  name = 'ProductSocialProof1787181000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gallery_item_products" (
        "galleryItemId" uuid NOT NULL,
        "productId"     uuid NOT NULL,
        "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gallery_item_products"
          PRIMARY KEY ("galleryItemId", "productId"),
        CONSTRAINT "FK_gallery_item_products_item"
          FOREIGN KEY ("galleryItemId") REFERENCES "gallery_items"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_gallery_item_products_product"
          FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
      )
    `);
    // The product page asks "which shots feature this piece", which the
    // primary key's leading column cannot answer.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_gallery_item_products_product" ON "gallery_item_products" ("productId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_fit_ratings" (
        "id"        uuid NOT NULL DEFAULT uuid_generate_v4(),
        "productId" uuid NOT NULL,
        "userId"    uuid NOT NULL,
        "size"      character varying(20) NOT NULL DEFAULT '',
        "value"     smallint NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_fit_ratings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_product_fit_ratings_product"
          FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_product_fit_ratings_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_product_fit_ratings_value" CHECK ("value" IN (-1, 0, 1))
      )
    `);
    // One reading per person per piece; rating again edits the first.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_fit_ratings_product_user" ON "product_fit_ratings" ("productId", "userId")`,
    );

    // Denormalised the same way likeCount is, for the same reason: the grid
    // would otherwise need a grouped subquery per row.
    for (const column of ['fitSmallCount', 'fitTrueCount', 'fitLargeCount']) {
      await queryRunner.query(
        `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "${column}" integer NOT NULL DEFAULT 0`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of ['fitLargeCount', 'fitTrueCount', 'fitSmallCount']) {
      await queryRunner.query(
        `ALTER TABLE "products" DROP COLUMN IF EXISTS "${column}"`,
      );
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "product_fit_ratings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gallery_item_products"`);
  }
}
