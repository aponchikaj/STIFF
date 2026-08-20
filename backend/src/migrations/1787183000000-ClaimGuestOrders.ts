import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets an account take over the orders it placed before it existed.
 *
 * Mirrored in `sql/1787183000000-ClaimGuestOrders.sql`, which is the
 * reviewable record of what touches the database.
 *
 * A guest order is reachable by its uuid and by the email on it. Proving
 * ownership of that email — by verifying it on an account — is what transfers
 * it. `guestEmail` stays rather than being cleared: it is the address the
 * invoice actually went to, which is history. `claimedAt` is what distinguishes
 * "ordered while signed in" from "claimed afterwards", so the transfer is
 * auditable rather than invisible.
 */
export class ClaimGuestOrders1787183000000 implements MigrationInterface {
  name = 'ClaimGuestOrders1787183000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP WITH TIME ZONE`,
    );
    // The claim looks up unclaimed orders by lowercased email on every
    // sign-in; without this that is a sequential scan.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_orders_unclaimed_email" ON "orders" (lower("guestEmail")) WHERE "userId" IS NULL AND "guestEmail" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_orders_unclaimed_email"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "claimedAt"`,
    );
  }
}
