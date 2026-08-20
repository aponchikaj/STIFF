import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tracking numbers, customer cancellation, and returns.
 *
 * Mirrored in `sql/1787176000000-OrderLifecycle.sql`, which is the reviewable
 * record of what touches the database.
 *
 * `/rules` has promised "14 days, unworn, tags on" since launch with nothing in
 * the system to honour it. These tables are that promise made real.
 */
export class OrderLifecycle1787176000000 implements MigrationInterface {
  name = 'OrderLifecycle1787176000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [column, type] of [
      ['trackingCarrier', 'character varying(60)'],
      ['trackingNumber', 'character varying(120)'],
      ['trackingUrl', 'character varying(500)'],
      ['deliveredAt', 'TIMESTAMP WITH TIME ZONE'],
      ['cancelledAt', 'TIMESTAMP WITH TIME ZONE'],
      ['cancelledBy', 'character varying(10)'],
    ]) {
      await queryRunner.query(
        `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "${column}" ${type}`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "CHK_orders_cancelled_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "CHK_orders_cancelled_by" CHECK ("cancelledBy" IS NULL OR "cancelledBy" IN ('customer', 'admin'))`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "return_requests" (
        "id"             uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderId"        uuid NOT NULL,
        "status"         character varying(12) NOT NULL DEFAULT 'requested',
        "reason"         text NOT NULL DEFAULT '',
        "resolutionNote" text NOT NULL DEFAULT '',
        "refundCents"    integer NOT NULL DEFAULT 0,
        "resolvedAt"     TIMESTAMP WITH TIME ZONE,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_return_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_return_requests_order"
          FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_return_requests_status"
          CHECK ("status" IN ('requested','approved','rejected','received','refunded'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_return_requests_status" ON "return_requests" ("status", "createdAt" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_return_requests_orderId" ON "return_requests" ("orderId")`,
    );
    // Two live claims on the same parcel is an ambiguity nobody can resolve.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_return_requests_open_per_order" ON "return_requests" ("orderId") WHERE "status" IN ('requested', 'approved', 'received')`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "return_request_items" (
        "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
        "returnRequestId" uuid NOT NULL,
        "orderItemId"     uuid NOT NULL,
        "quantity"        integer NOT NULL,
        CONSTRAINT "PK_return_request_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_return_request_items_request"
          FOREIGN KEY ("returnRequestId") REFERENCES "return_requests"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_return_request_items_order_item"
          FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_return_request_items_quantity" CHECK ("quantity" > 0),
        CONSTRAINT "UQ_return_request_items_pair" UNIQUE ("returnRequestId", "orderItemId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "return_request_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "return_requests"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "CHK_orders_cancelled_by"`,
    );
    for (const column of [
      'cancelledBy',
      'cancelledAt',
      'deliveredAt',
      'trackingUrl',
      'trackingNumber',
      'trackingCarrier',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "orders" DROP COLUMN IF EXISTS "${column}"`,
      );
    }
  }
}
