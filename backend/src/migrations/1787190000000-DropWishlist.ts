import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the saved-pieces table.
 *
 * Mirrored in `sql/1787190000000-DropWishlist.sql`.
 *
 * A new migration rather than reverting `Wishlist1787182000000`, because that
 * one is already recorded as run on every environment sharing this database —
 * reverting it there would leave the migration history disagreeing with itself.
 * This is the ordinary way to retire a table: say so forwards.
 *
 * Safe for a branch that has not caught up yet only because the code reading
 * this table is removed on every branch in the same change. Dropping a table a
 * deployed branch still selects from is the one thing the shared database
 * cannot survive, which is why the two go together.
 */
export class DropWishlist1787190000000 implements MigrationInterface {
  name = 'DropWishlist1787190000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The indexes and foreign keys go with it.
    await queryRunner.query(`DROP TABLE IF EXISTS "wishlist_items"`);
  }

  /**
   * Recreates the table, empty.
   *
   * What was in it is not recoverable from here — a down migration can restore
   * a shape, never the rows. The backup taken before this ran is the only way
   * back to the contents.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
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
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_wishlist_items_user_product" ON "wishlist_items" ("userId", "productId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_wishlist_items_product" ON "wishlist_items" ("productId")`,
    );
  }
}
