import { MigrationInterface, QueryRunner } from 'typeorm';

export class GallerySlug1786442135599 implements MigrationInterface {
  name = 'GallerySlug1786442135599';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Add the new column as nullable.
    await queryRunner.query(
      `ALTER TABLE "gallery_items" ADD COLUMN "slug" character varying(120)`,
    );

    // 2) Preserve current routing behavior for existing rows.
    // Before this migration, the public URL param was the unique `title`.
    // We set `slug = title` so all old shared links keep resolving.
    await queryRunner.query(`UPDATE "gallery_items" SET "slug" = "title"`);

    // 3) Enforce NOT NULL + uniqueness on the stable slug.
    await queryRunner.query(
      `ALTER TABLE "gallery_items" ALTER COLUMN "slug" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "gallery_items" ADD CONSTRAINT "UQ_gallery_items_slug" UNIQUE ("slug")`,
    );

    // 4) Remove the old uniqueness constraint on title.
    // This turns titles into human labels that can safely change.
    await queryRunner.query(
      `ALTER TABLE "gallery_items" DROP CONSTRAINT "UQ_ce30a8d27258668aa1f580e9727"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: this may fail if titles were edited into duplicates after the
    // migration. That's expected if the rollback is attempted later.
    await queryRunner.query(
      `ALTER TABLE "gallery_items" DROP CONSTRAINT "UQ_gallery_items_slug"`,
    );
    await queryRunner.query(`ALTER TABLE "gallery_items" DROP COLUMN "slug"`);

    await queryRunner.query(
      `ALTER TABLE "gallery_items" ADD CONSTRAINT "UQ_ce30a8d27258668aa1f580e9727" UNIQUE ("title")`,
    );
  }
}
