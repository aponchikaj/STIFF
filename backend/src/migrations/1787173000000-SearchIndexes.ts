import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ranked full-text search with typo tolerance.
 *
 * Mirrored in `sql/1787173000000-SearchIndexes.sql`, which is the reviewable
 * record of what touches the database. Keep the two in step if either changes.
 *
 * Expression indexes rather than generated columns, so no entity gains a
 * column it never reads. `search/search.sql.ts` holds the single copy of each
 * expression, and the query is built from the same constant the index uses.
 */
export class SearchIndexes1787173000000 implements MigrationInterface {
  name = 'SearchIndexes1787173000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions`,
    );

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_products_search_fts"
        ON "products" USING GIN ((
          setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
          setweight(to_tsvector('english', coalesce("category", '')), 'B') ||
          setweight(to_tsvector('english', coalesce("description", '')), 'C')
        ))
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_products_name_trgm" ON "products" USING GIN ("name" extensions.gin_trgm_ops)`,
    );

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_gallery_search_fts"
        ON "gallery_items" USING GIN ((
          setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
          setweight(to_tsvector('english', coalesce("altText", '')), 'B') ||
          setweight(to_tsvector('english', coalesce("description", '')), 'C')
        ))
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_gallery_title_trgm" ON "gallery_items" USING GIN ("title" extensions.gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_gallery_title_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_gallery_search_fts"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_name_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_search_fts"`);
    // pg_trgm is left installed: dropping a shared extension could break
    // anything else in the database that started using it.
  }
}
