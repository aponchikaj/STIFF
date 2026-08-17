import { MigrationInterface, QueryRunner } from 'typeorm';

export class StaffWorkspace1786742000000 implements MigrationInterface {
  name = 'StaffWorkspace1786742000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "staff_users_role_enum" AS ENUM('owner', 'admin', 'member')`,
    );
    await queryRunner.query(
      `CREATE TABLE "staff_users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying NOT NULL, "email" character varying NOT NULL, "instagramUsername" character varying NOT NULL, "passwordHash" character varying NOT NULL, "role" "staff_users_role_enum" NOT NULL DEFAULT 'member', "isBlocked" boolean NOT NULL DEFAULT false, "createdById" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_staff_users_username" UNIQUE ("username"), CONSTRAINT "UQ_staff_users_email" UNIQUE ("email"), CONSTRAINT "UQ_staff_users_instagram" UNIQUE ("instagramUsername"), CONSTRAINT "PK_staff_users" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "staff_refresh_tokens" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "replacedById" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_staff_refresh_tokens" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_staff_refresh_tokens_userId" ON "staff_refresh_tokens" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_refresh_tokens" ADD CONSTRAINT "FK_staff_refresh_tokens_user" FOREIGN KEY ("userId") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TYPE "staff_conversations_type_enum" AS ENUM('main', 'dm')`,
    );
    await queryRunner.query(
      `CREATE TABLE "staff_conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "staff_conversations_type_enum" NOT NULL, "dmKey" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_staff_conversations_dmKey" UNIQUE ("dmKey"), CONSTRAINT "PK_staff_conversations" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "staff_conversation_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversationId" uuid NOT NULL, "userId" uuid NOT NULL, "lastReadAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_staff_conversation_members_pair" UNIQUE ("conversationId", "userId"), CONSTRAINT "PK_staff_conversation_members" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_staff_conversation_members_conversationId" ON "staff_conversation_members" ("conversationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_staff_conversation_members_userId" ON "staff_conversation_members" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_conversation_members" ADD CONSTRAINT "FK_staff_conversation_members_conversation" FOREIGN KEY ("conversationId") REFERENCES "staff_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_conversation_members" ADD CONSTRAINT "FK_staff_conversation_members_user" FOREIGN KEY ("userId") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "staff_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversationId" uuid NOT NULL, "senderId" uuid NOT NULL, "body" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_staff_messages" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_staff_messages_conversation_created" ON "staff_messages" ("conversationId", "createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_messages" ADD CONSTRAINT "FK_staff_messages_conversation" FOREIGN KEY ("conversationId") REFERENCES "staff_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_messages" ADD CONSTRAINT "FK_staff_messages_sender" FOREIGN KEY ("senderId") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TYPE "staff_tasks_status_enum" AS ENUM('todo', 'in_progress', 'done')`,
    );
    await queryRunner.query(
      `CREATE TABLE "staff_tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" text NOT NULL DEFAULT '', "status" "staff_tasks_status_enum" NOT NULL DEFAULT 'todo', "position" double precision NOT NULL DEFAULT 0, "assigneeId" uuid NOT NULL, "createdById" uuid, "dueDate" date, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_staff_tasks" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_staff_tasks_assignee_status" ON "staff_tasks" ("assigneeId", "status")`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_tasks" ADD CONSTRAINT "FK_staff_tasks_assignee" FOREIGN KEY ("assigneeId") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_tasks" ADD CONSTRAINT "FK_staff_tasks_createdBy" FOREIGN KEY ("createdById") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "staff_notes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "title" character varying NOT NULL, "body" text NOT NULL DEFAULT '', "pinned" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_staff_notes" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_staff_notes_userId" ON "staff_notes" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_notes" ADD CONSTRAINT "FK_staff_notes_user" FOREIGN KEY ("userId") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `INSERT INTO "staff_conversations" ("type", "dmKey") VALUES ('main', 'main')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "staff_notes" DROP CONSTRAINT "FK_staff_notes_user"`,
    );
    await queryRunner.query(`DROP TABLE "staff_notes"`);
    await queryRunner.query(
      `ALTER TABLE "staff_tasks" DROP CONSTRAINT "FK_staff_tasks_createdBy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_tasks" DROP CONSTRAINT "FK_staff_tasks_assignee"`,
    );
    await queryRunner.query(`DROP TABLE "staff_tasks"`);
    await queryRunner.query(`DROP TYPE "staff_tasks_status_enum"`);
    await queryRunner.query(
      `ALTER TABLE "staff_messages" DROP CONSTRAINT "FK_staff_messages_sender"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_messages" DROP CONSTRAINT "FK_staff_messages_conversation"`,
    );
    await queryRunner.query(`DROP TABLE "staff_messages"`);
    await queryRunner.query(
      `ALTER TABLE "staff_conversation_members" DROP CONSTRAINT "FK_staff_conversation_members_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_conversation_members" DROP CONSTRAINT "FK_staff_conversation_members_conversation"`,
    );
    await queryRunner.query(`DROP TABLE "staff_conversation_members"`);
    await queryRunner.query(`DROP TABLE "staff_conversations"`);
    await queryRunner.query(`DROP TYPE "staff_conversations_type_enum"`);
    await queryRunner.query(
      `ALTER TABLE "staff_refresh_tokens" DROP CONSTRAINT "FK_staff_refresh_tokens_user"`,
    );
    await queryRunner.query(`DROP TABLE "staff_refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "staff_users"`);
    await queryRunner.query(`DROP TYPE "staff_users_role_enum"`);
  }
}
