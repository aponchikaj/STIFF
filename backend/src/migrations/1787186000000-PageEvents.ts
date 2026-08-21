import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Named moments on a page.
 *
 * Mirrored in `sql/1787186000000-PageEvents.sql`.
 *
 * `page_views` records arrivals, which cannot distinguish somebody who read
 * the whole home page from somebody who left during the hero. The page has
 * seven acts and no evidence about which of them anybody reaches; this is one
 * row per named moment per visit, joined to a view by the same anonymous
 * visitor id.
 */
export class PageEvents1787186000000 implements MigrationInterface {
  name = 'PageEvents1787186000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "page_events" (
        "id"        uuid NOT NULL DEFAULT uuid_generate_v4(),
        "path"      character varying(200) NOT NULL,
        "name"      character varying(40) NOT NULL,
        "label"     character varying(60),
        "visitorId" uuid NOT NULL,
        "userId"    uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_page_events" PRIMARY KEY ("id")
      )
    `);
    // Every report is "this event, on this path, over this window".
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_page_events_lookup" ON "page_events" ("name", "path", "createdAt")`,
    );
    // Reach is counted in distinct visitors, not rows.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_page_events_visitor" ON "page_events" ("visitorId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "page_events"`);
  }
}
