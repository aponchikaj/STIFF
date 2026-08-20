import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A private list of pieces someone means to come back for.
 *
 * Mirrored in `sql/1787182000000-Wishlist.sql`, which is the reviewable record
 * of what touches the database.
 *
 * Deliberately separate from `reactions`. A like is a public signal that feeds
 * the "popular" sort and shows a count to everyone; a wishlist is private
 * intent. Conflating them loses both — people withhold likes on things they
 * want kept quiet, and the popularity sort fills with bookmarks.
 */
export class Wishlist1787182000000 implements MigrationInterface {
  name = 'Wishlist1787182000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wishlist_items" (
        "id"        uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId"    uuid NOT NULL,
        "productId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wishlist_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_wishlist_items_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_wishlist_items_product"
          FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
      )
    `);
    // Saving twice is saving once.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_wishlist_items_user_product" ON "wishlist_items" ("userId", "productId")`,
    );
    // "How many people saved this", without a full scan.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_wishlist_items_product" ON "wishlist_items" ("productId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "wishlist_items"`);
  }
}
