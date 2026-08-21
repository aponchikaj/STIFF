import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The drop list.
 *
 * Mirrored in `sql/1787185000000-Subscribers.sql`, which is the reviewable
 * record of what touches the database.
 *
 * Deliberately separate from `users`. Someone who wants to hear about a drop
 * has not agreed to have an account, and making them register to get an email
 * is how a list stays small. Double opt-in is enforced by the `status` column:
 * nothing is ever sent to a `pending` address except the one confirmation, so
 * a typo'd or malicious signup cannot turn into a mailing.
 */
export class Subscribers1787185000000 implements MigrationInterface {
  name = 'Subscribers1787185000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscribers" (
        "id"                uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email"             character varying(180) NOT NULL,
        "status"            character varying(20) NOT NULL DEFAULT 'pending',
        "confirmToken"      character varying(64),
        "confirmSentAt"     TIMESTAMP,
        "unsubscribeToken"  character varying(64) NOT NULL,
        "source"            character varying(40) NOT NULL DEFAULT 'home',
        "confirmedAt"       TIMESTAMP,
        "unsubscribedAt"    TIMESTAMP,
        "createdAt"         TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"         TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscribers" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_subscribers_status"
          CHECK ("status" IN ('pending', 'confirmed', 'unsubscribed'))
      )
    `);

    // One row per address, case-insensitively: two rows for one inbox would
    // mean two emails and two unsubscribe links.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_subscribers_email" ON "subscribers" (lower("email"))`,
    );

    // Both tokens are looked up by value, from a link, before anything else
    // about the request is known.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_subscribers_confirm_token" ON "subscribers" ("confirmToken") WHERE "confirmToken" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_subscribers_unsubscribe_token" ON "subscribers" ("unsubscribeToken")`,
    );

    // "Who do we actually send to" — the only query that runs at send time.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_subscribers_status" ON "subscribers" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "subscribers"`);
  }
}
