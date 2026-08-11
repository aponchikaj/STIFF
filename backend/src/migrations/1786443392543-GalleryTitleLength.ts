import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bring the column in line with the entity, which has declared
 * `varchar(120)` since titles stopped being the URL slug.
 *
 * Written by hand rather than generated: TypeORM's generated version drops
 * the column and adds it back, which would take every title with it. An
 * in-place type change keeps the data — and 120 is already the maximum the
 * DTO accepts, so nothing currently stored can be too long for it.
 */
export class GalleryTitleLength1786443392543 implements MigrationInterface {
  name = 'GalleryTitleLength1786443392543';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "gallery_items" ALTER COLUMN "title" TYPE character varying(120)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "gallery_items" ALTER COLUMN "title" TYPE character varying`,
    );
  }
}
