import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1786441623740 implements MigrationInterface {
    name = 'InitialSchema1786441623740'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "analytics_snapshots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" date NOT NULL, "revenueCents" integer NOT NULL DEFAULT '0', "ordersCount" integer NOT NULL DEFAULT '0', "signupsCount" integer NOT NULL DEFAULT '0', "newCommentsCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_6815d7cc66253a4679f0ceebe62" UNIQUE ("date"), CONSTRAINT "PK_72ddc015c269977322f808a19a7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "page_views" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "path" character varying(200) NOT NULL, "visitorId" uuid NOT NULL, "userId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3b1047277a9c2a8cfd618787671" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_731b31872f76dd00f9d5b34761" ON "page_views"  ("path") `);
        await queryRunner.query(`CREATE INDEX "IDX_1e55c7b3225bb9f2520e883449" ON "page_views"  ("visitorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_72e1c729a5408f7da7c744689b" ON "page_views"  ("createdAt") `);
        await queryRunner.query(`CREATE TYPE "users_role_enum" AS ENUM('user', 'admin')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying NOT NULL, "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "role" "users_role_enum" NOT NULL DEFAULT 'user', "isVerified" boolean NOT NULL DEFAULT false, "isBlocked" boolean NOT NULL DEFAULT false, "settings" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "email_tokens_type_enum" AS ENUM('verify', 'reset')`);
        await queryRunner.query(`CREATE TABLE "email_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "type" "email_tokens_type_enum" NOT NULL, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "usedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_08abb3fa348e894c274a6730d35" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_aa5917bcee5cc8579c2f390892" ON "email_tokens"  ("userId", "type") `);
        await queryRunner.query(`CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "replacedById" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_610102b60fea1455310ccd299d" ON "refresh_tokens"  ("userId") `);
        await queryRunner.query(`CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "description" text NOT NULL DEFAULT '', "priceCents" integer NOT NULL, "images" text array NOT NULL DEFAULT '{}', "category" character varying, "sizes" text array NOT NULL DEFAULT '{}', "stock" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "likeCount" integer NOT NULL DEFAULT '0', "dislikeCount" integer NOT NULL DEFAULT '0', "commentCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_464f927ae360106b783ed0b4106" UNIQUE ("slug"), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "cart_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "productId" uuid NOT NULL, "quantity" integer NOT NULL, "size" character varying NOT NULL DEFAULT '', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_678f7fdd2b61c01a1316eacabf7" UNIQUE ("userId", "productId", "size"), CONSTRAINT "PK_6fccf5ec03c172d27a28a82928b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_84e765378a5f03ad9900df3a9b" ON "cart_items"  ("userId") `);
        await queryRunner.query(`CREATE TYPE "comments_targettype_enum" AS ENUM('product', 'gallery')`);
        await queryRunner.query(`CREATE TABLE "comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "targetType" "comments_targettype_enum" NOT NULL, "targetId" uuid NOT NULL, "body" text NOT NULL, "parentId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f3ce9f81b6ebb319fd25b1b726" ON "comments"  ("targetType", "targetId") `);
        await queryRunner.query(`CREATE TABLE "contact_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "email" character varying NOT NULL, "subject" character varying, "message" text NOT NULL, "isHandled" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b74f96eb2edd977ccfba6533293" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "site_content" ("key" character varying NOT NULL, "value" jsonb NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_22c94a453d6f09969b9b99ee6b6" PRIMARY KEY ("key"))`);
        await queryRunner.query(`CREATE TABLE "gallery_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" text, "imageUrl" character varying NOT NULL, "width" integer, "height" integer, "sortOrder" integer NOT NULL DEFAULT '0', "isArchived" boolean NOT NULL DEFAULT false, "likeCount" integer NOT NULL DEFAULT '0', "dislikeCount" integer NOT NULL DEFAULT '0', "commentCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ce30a8d27258668aa1f580e9727" UNIQUE ("title"), CONSTRAINT "PK_ca2915427d004dec2ff17f45a49" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "notifications_type_enum" AS ENUM('order_status', 'comment_reply', 'broadcast', 'system')`);
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "type" "notifications_type_enum" NOT NULL, "title" character varying NOT NULL, "body" text NOT NULL, "isRead" boolean NOT NULL DEFAULT false, "meta" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_692a909ee0fa9383e7859f9b40" ON "notifications"  ("userId") `);
        await queryRunner.query(`CREATE TYPE "orders_status_enum" AS ENUM('pending', 'paid', 'shipped', 'delivered', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid, "status" "orders_status_enum" NOT NULL DEFAULT 'pending', "totalCents" integer NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'usd', "paymentIntentId" character varying, "shippingAddress" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_151b79a83ba240b0cb31b2302d" ON "orders"  ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_775c9f06fc27ae3ff8fb26f2c4" ON "orders"  ("status") `);
        await queryRunner.query(`CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderId" uuid NOT NULL, "productId" uuid, "productName" character varying NOT NULL, "productImage" character varying, "unitPriceCents" integer NOT NULL, "quantity" integer NOT NULL, "size" character varying NOT NULL DEFAULT '', CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "reactions_targettype_enum" AS ENUM('product', 'gallery')`);
        await queryRunner.query(`CREATE TYPE "reactions_type_enum" AS ENUM('like', 'dislike')`);
        await queryRunner.query(`CREATE TABLE "reactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "targetType" "reactions_targettype_enum" NOT NULL, "targetId" uuid NOT NULL, "type" "reactions_type_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_989f04b0d4b2c2513421b05aeac" UNIQUE ("userId", "targetType", "targetId"), CONSTRAINT "PK_0b213d460d0c473bc2fb6ee27f3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_78566f399e21723dcdd6754226" ON "reactions"  ("targetType", "targetId") `);
        await queryRunner.query(`ALTER TABLE "email_tokens" ADD CONSTRAINT "FK_0a5e6c81093655b770eabd04600" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cart_items" ADD CONSTRAINT "FK_84e765378a5f03ad9900df3a9ba" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cart_items" ADD CONSTRAINT "FK_72679d98b31c737937b8932ebe6" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_7e8d7c49f218ebb14314fdb3749" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_8770bd9030a3d13c5f79a7d2e81" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_151b79a83ba240b0cb31b2302d1" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_cdb99c05982d5191ac8465ac010" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reactions" ADD CONSTRAINT "FK_f3e1d278edeb2c19a2ddad83f8e" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reactions" DROP CONSTRAINT "FK_f3e1d278edeb2c19a2ddad83f8e"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_cdb99c05982d5191ac8465ac010"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_151b79a83ba240b0cb31b2302d1"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_692a909ee0fa9383e7859f9b406"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_8770bd9030a3d13c5f79a7d2e81"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_7e8d7c49f218ebb14314fdb3749"`);
        await queryRunner.query(`ALTER TABLE "cart_items" DROP CONSTRAINT "FK_72679d98b31c737937b8932ebe6"`);
        await queryRunner.query(`ALTER TABLE "cart_items" DROP CONSTRAINT "FK_84e765378a5f03ad9900df3a9ba"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`);
        await queryRunner.query(`ALTER TABLE "email_tokens" DROP CONSTRAINT "FK_0a5e6c81093655b770eabd04600"`);
        await queryRunner.query(`DROP INDEX "IDX_78566f399e21723dcdd6754226"`);
        await queryRunner.query(`DROP TABLE "reactions"`);
        await queryRunner.query(`DROP TYPE "reactions_type_enum"`);
        await queryRunner.query(`DROP TYPE "reactions_targettype_enum"`);
        await queryRunner.query(`DROP TABLE "order_items"`);
        await queryRunner.query(`DROP INDEX "IDX_775c9f06fc27ae3ff8fb26f2c4"`);
        await queryRunner.query(`DROP INDEX "IDX_151b79a83ba240b0cb31b2302d"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TYPE "orders_status_enum"`);
        await queryRunner.query(`DROP INDEX "IDX_692a909ee0fa9383e7859f9b40"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP TYPE "notifications_type_enum"`);
        await queryRunner.query(`DROP TABLE "gallery_items"`);
        await queryRunner.query(`DROP TABLE "site_content"`);
        await queryRunner.query(`DROP TABLE "contact_messages"`);
        await queryRunner.query(`DROP INDEX "IDX_f3ce9f81b6ebb319fd25b1b726"`);
        await queryRunner.query(`DROP TABLE "comments"`);
        await queryRunner.query(`DROP TYPE "comments_targettype_enum"`);
        await queryRunner.query(`DROP INDEX "IDX_84e765378a5f03ad9900df3a9b"`);
        await queryRunner.query(`DROP TABLE "cart_items"`);
        await queryRunner.query(`DROP TABLE "products"`);
        await queryRunner.query(`DROP INDEX "IDX_610102b60fea1455310ccd299d"`);
        await queryRunner.query(`DROP TABLE "refresh_tokens"`);
        await queryRunner.query(`DROP INDEX "IDX_aa5917bcee5cc8579c2f390892"`);
        await queryRunner.query(`DROP TABLE "email_tokens"`);
        await queryRunner.query(`DROP TYPE "email_tokens_type_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "users_role_enum"`);
        await queryRunner.query(`DROP INDEX "IDX_72e1c729a5408f7da7c744689b"`);
        await queryRunner.query(`DROP INDEX "IDX_1e55c7b3225bb9f2520e883449"`);
        await queryRunner.query(`DROP INDEX "IDX_731b31872f76dd00f9d5b34761"`);
        await queryRunner.query(`DROP TABLE "page_views"`);
        await queryRunner.query(`DROP TABLE "analytics_snapshots"`);
    }

}
