import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes for the twelve foreign keys that did not have one.
 *
 * Postgres indexes the *referenced* side of a foreign key automatically — it
 * has to, the target is a primary or unique key — and indexes the referencing
 * side never. That asymmetry is easy to miss because nothing warns about it and
 * nothing is slow while the tables are small, which is exactly the state this
 * database is in today: `order_items` has one row and a single index, its
 * primary key.
 *
 * Two things get worse without these, and neither shows up in development:
 *
 * 1. **Reads.** `order_items."orderId"` is the hottest join in the shop —
 *    every order page, every admin list, every confirmation email resolves
 *    items by order. Unindexed, each one is a sequential scan.
 * 2. **Deletes.** A parent delete must check or cascade every referencing row.
 *    Deleting one product scans all of `order_items` and all of `cart_items`;
 *    deleting a staff role scans `staff_users`. The cost lands on the delete,
 *    far from the table anyone was thinking about.
 *
 * Plain `CREATE INDEX`, not `CONCURRENTLY`: the concurrent form cannot run
 * inside a transaction, and TypeORM wraps migrations in one. These tables hold
 * single-digit row counts, so the brief lock is measured in milliseconds. If
 * this ever needs re-running against a large table, do it by hand with
 * `CONCURRENTLY` and outside the migration runner.
 *
 * Additive and `IF NOT EXISTS` throughout, so it is safe on every branch and
 * safe to run twice.
 */
export class ForeignKeyIndexes1787270000000 implements MigrationInterface {
  name = 'ForeignKeyIndexes1787270000000';

  /**
   * Every single-column foreign key in `public` that had no index leading with
   * its column, as of this migration.
   */
  private readonly indexes: [table: string, column: string][] = [
    // The shop. `orderId` is the one that matters most.
    ['order_items', 'orderId'],
    ['order_items', 'productId'],
    ['order_items', 'variantId'],
    ['cart_items', 'productId'],
    ['comments', 'userId'],
    ['comments', 'parentId'],
    ['collab_sessions', 'campaignId'],
    // The staff workspace.
    ['staff_users', 'roleId'],
    ['staff_tasks', 'createdById'],
    ['staff_messages', 'senderId'],
    // The game. The season/user lookups are already covered by
    // UQ_game_enrolments_season_user; this is the other direction — "everything
    // this user is in", and the cascade when an account is deleted.
    ['game_enrolments', 'userId'],
    ['game_task_templates', 'approvedBy'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of this.indexes) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_${table}_${column}" ON "${table}" ("${column}")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of this.indexes) {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_${table}_${column}"`);
    }
  }
}
