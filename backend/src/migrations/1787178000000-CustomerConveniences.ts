import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Saved addresses and back-in-stock alerts.
 *
 * Mirrored in `sql/1787178000000-CustomerConveniences.sql`, which is the
 * reviewable record of what touches the database.
 *
 * Addresses get a table rather than a corner of `users.settings`: they are
 * queried, defaulted and listed, and a jsonb blob cannot enforce "exactly one
 * default".
 */
export class CustomerConveniences1787178000000 implements MigrationInterface {
  name = 'CustomerConveniences1787178000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_addresses" (
        "id"         uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId"     uuid NOT NULL,
        "label"      character varying(40) NOT NULL DEFAULT '',
        "firstName"  character varying(60) NOT NULL,
        "lastName"   character varying(60) NOT NULL,
        "line1"      character varying(200) NOT NULL DEFAULT '',
        "line2"      character varying(200),
        "city"       character varying(80) NOT NULL DEFAULT '',
        "region"     character varying(80),
        "postalCode" character varying(20),
        "country"    character varying(80) NOT NULL DEFAULT 'Georgia',
        "phone"      character varying(30) NOT NULL,
        "isDefault"  boolean NOT NULL DEFAULT false,
        "createdAt"  TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_addresses" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_addresses_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_addresses_userId" ON "user_addresses" ("userId")`,
    );
    // Two defaults would make checkout pick arbitrarily.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_addresses_one_default" ON "user_addresses" ("userId") WHERE "isDefault"`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_alerts" (
        "id"         uuid NOT NULL DEFAULT uuid_generate_v4(),
        "variantId"  uuid NOT NULL,
        "userId"     uuid,
        "email"      character varying(180),
        "notifiedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt"  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stock_alerts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stock_alerts_variant"
          FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_stock_alerts_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_stock_alerts_one_owner"
          CHECK (("userId" IS NOT NULL) <> ("email" IS NOT NULL))
      )
    `);
    // Partial on notifiedAt, so someone can subscribe again next time.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_stock_alerts_user_variant" ON "stock_alerts" ("variantId", "userId") WHERE "userId" IS NOT NULL AND "notifiedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_stock_alerts_email_variant" ON "stock_alerts" ("variantId", lower("email")) WHERE "email" IS NOT NULL AND "notifiedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_alerts_pending" ON "stock_alerts" ("variantId") WHERE "notifiedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_alerts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_addresses"`);
  }
}
