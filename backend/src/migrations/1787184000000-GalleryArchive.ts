import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gives the archive the structure it is actually made with.
 *
 * Mirrored in `sql/1787184000000-GalleryArchive.sql`, which is the reviewable
 * record of what touches the database and carries the reasoning per table.
 *
 * Five additions, all additive and all nullable or defaulted, because this
 * database is shared with branches that do not have the code yet:
 *
 * - `gallery_shoots` + `gallery_items.shootId` — a shoot is a day, a place and
 *   a set of people; the archive has been throwing that away and keeping only
 *   the frames.
 * - `gallery_credits` — photographer, model, stylist, hung off either a shoot
 *   or a single shot, never both.
 * - `gallery_tags` + `gallery_item_tags` — season and location are the axes
 *   the archive is browsed along; sort order was the only one available.
 * - `gallery_item_products.hotspotX/Y` — where on the frame a piece is worn,
 *   so the lookbook can be shopped from the photograph.
 * - `gallery_items.blurDataUrl` — an inline placeholder for the grid.
 */
export class GalleryArchive1787184000000 implements MigrationInterface {
  name = 'GalleryArchive1787184000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- shoots ----
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gallery_shoots" (
        "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slug"        character varying(120) NOT NULL,
        "title"       character varying(160) NOT NULL,
        "description" text,
        "location"    character varying(160),
        "shotOn"      date,
        "coverItemId" uuid,
        "sortOrder"   integer NOT NULL DEFAULT 0,
        "isPublished" boolean NOT NULL DEFAULT true,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gallery_shoots" PRIMARY KEY ("id"),
        CONSTRAINT "FK_gallery_shoots_cover"
          FOREIGN KEY ("coverItemId") REFERENCES "gallery_items"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_gallery_shoots_slug" ON "gallery_shoots" ("slug")`,
    );

    // Nullable: the existing archive predates shoots and belongs to none.
    await queryRunner.query(
      `ALTER TABLE "gallery_items" ADD COLUMN IF NOT EXISTS "shootId" uuid`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "gallery_items" ADD CONSTRAINT "FK_gallery_items_shoot"
          FOREIGN KEY ("shootId") REFERENCES "gallery_shoots"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_gallery_items_shoot" ON "gallery_items" ("shootId")`,
    );

    // ---- credits ----
    // The CHECK is the one-owner pattern `cart_items` uses: a credit belongs
    // to the shoot or to one shot, and cannot claim both.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gallery_credits" (
        "id"            uuid NOT NULL DEFAULT uuid_generate_v4(),
        "shootId"       uuid,
        "galleryItemId" uuid,
        "role"          character varying(40) NOT NULL,
        "name"          character varying(120) NOT NULL,
        "instagram"     character varying(60),
        "url"           character varying(300),
        "sortOrder"     integer NOT NULL DEFAULT 0,
        "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gallery_credits" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_gallery_credits_one_owner"
          CHECK (("shootId" IS NULL) <> ("galleryItemId" IS NULL)),
        CONSTRAINT "FK_gallery_credits_shoot"
          FOREIGN KEY ("shootId") REFERENCES "gallery_shoots"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_gallery_credits_item"
          FOREIGN KEY ("galleryItemId") REFERENCES "gallery_items"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_gallery_credits_shoot" ON "gallery_credits" ("shootId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_gallery_credits_item" ON "gallery_credits" ("galleryItemId")`,
    );

    // ---- tags ----
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gallery_tags" (
        "id"        uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slug"      character varying(80) NOT NULL,
        "label"     character varying(80) NOT NULL,
        "kind"      character varying(20) NOT NULL DEFAULT 'theme',
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gallery_tags" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_gallery_tags_kind"
          CHECK ("kind" IN ('season', 'location', 'theme'))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_gallery_tags_slug" ON "gallery_tags" ("slug")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gallery_item_tags" (
        "galleryItemId" uuid NOT NULL,
        "tagId"         uuid NOT NULL,
        CONSTRAINT "PK_gallery_item_tags" PRIMARY KEY ("galleryItemId", "tagId"),
        CONSTRAINT "FK_gallery_item_tags_item"
          FOREIGN KEY ("galleryItemId") REFERENCES "gallery_items"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_gallery_item_tags_tag"
          FOREIGN KEY ("tagId") REFERENCES "gallery_tags"("id") ON DELETE CASCADE
      )
    `);
    // The PK covers "tags of this shot"; this covers "shots with this tag",
    // which is the direction the filter reads.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_gallery_item_tags_tag" ON "gallery_item_tags" ("tagId")`,
    );

    // ---- hotspots ----
    // Percentages of the displayed frame, after `rotation` is applied — the
    // space the admin clicked in and the visitor sees. Source pixels would
    // need re-deriving on every render and would move every pin the day a
    // shot is rotated.
    await queryRunner.query(
      `ALTER TABLE "gallery_item_products" ADD COLUMN IF NOT EXISTS "hotspotX" real`,
    );
    await queryRunner.query(
      `ALTER TABLE "gallery_item_products" ADD COLUMN IF NOT EXISTS "hotspotY" real`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "gallery_item_products" ADD CONSTRAINT "CHK_gallery_item_products_hotspot"
          CHECK (
            ("hotspotX" IS NULL) = ("hotspotY" IS NULL)
            AND ("hotspotX" IS NULL OR ("hotspotX" BETWEEN 0 AND 100 AND "hotspotY" BETWEEN 0 AND 100))
          );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    // ---- placeholders ----
    // Inline base64 rather than a URL: a grid of twenty-four placeholder
    // *requests* competes with the photographs it stands in for, which is the
    // problem it exists to solve.
    await queryRunner.query(
      `ALTER TABLE "gallery_items" ADD COLUMN IF NOT EXISTS "blurDataUrl" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "gallery_items" DROP COLUMN IF EXISTS "blurDataUrl"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gallery_item_products" DROP CONSTRAINT IF EXISTS "CHK_gallery_item_products_hotspot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gallery_item_products" DROP COLUMN IF EXISTS "hotspotX"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gallery_item_products" DROP COLUMN IF EXISTS "hotspotY"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "gallery_item_tags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gallery_tags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gallery_credits"`);
    await queryRunner.query(
      `ALTER TABLE "gallery_items" DROP CONSTRAINT IF EXISTS "FK_gallery_items_shoot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "gallery_items" DROP COLUMN IF EXISTS "shootId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "gallery_shoots"`);
  }
}
