import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1733515200000 implements MigrationInterface {
    name = 'InitialSchema1733515200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE EXTENSION IF NOT EXISTS vector;
        `);

        await queryRunner.query(`
            CREATE TABLE "vendor" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "email" text NOT NULL,
                CONSTRAINT "UQ_vendor_email" UNIQUE ("email"),
                CONSTRAINT "PK_vendor_id" PRIMARY KEY ("id")
            );
        `);

        await queryRunner.query(`
            CREATE TABLE "rfp" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_input" text NOT NULL,
                "embedding" vector(1536),
                "budgetAmount" numeric NOT NULL,
                "budgetCurrency" text,
                "proporsalFinalisingEndDate" integer,
                "extraItems" jsonb NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_rfp_id" PRIMARY KEY ("id")
            );
        `);

        await queryRunner.query(`
            CREATE TABLE "rfp_item" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "description" text,
                "quantity" integer NOT NULL DEFAULT 1,
                "specs" jsonb NOT NULL DEFAULT '{}',
                "rfpId" uuid,
                CONSTRAINT "PK_rfp_item_id" PRIMARY KEY ("id")
            );
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_rfp_item_rfp" ON "rfp_item" ("rfpId");
        `);

        await queryRunner.query(`
            CREATE TABLE "rfp_proposal" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "budgetAmount" numeric,
                "budgetCurrency" text,
                "items" jsonb NOT NULL DEFAULT '[]',
                "extraItems" jsonb,
                "notes" text,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "rfpId" uuid,
                "vendorId" uuid,
                CONSTRAINT "PK_rfp_proposal_id" PRIMARY KEY ("id")
            );
        `);

        await queryRunner.query(`
            ALTER TABLE "rfp_item"
            ADD CONSTRAINT "FK_rfp_item_rfp"
            FOREIGN KEY ("rfpId")
            REFERENCES "rfp"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION;
        `);

        await queryRunner.query(`
            ALTER TABLE "rfp_proposal"
            ADD CONSTRAINT "FK_rfp_proposal_rfp"
            FOREIGN KEY ("rfpId")
            REFERENCES "rfp"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION;
        `);

        await queryRunner.query(`
            ALTER TABLE "rfp_proposal"
            ADD CONSTRAINT "FK_rfp_proposal_vendor"
            FOREIGN KEY ("vendorId")
            REFERENCES "vendor"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION;
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_rfp_embedding_hnsw"
            ON "rfp"
            USING hnsw ("embedding" vector_cosine_ops);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "rfp_proposal" DROP CONSTRAINT "FK_rfp_proposal_vendor";
        `);

        await queryRunner.query(`
            ALTER TABLE "rfp_proposal" DROP CONSTRAINT "FK_rfp_proposal_rfp";
        `);

        await queryRunner.query(`
            ALTER TABLE "rfp_item" DROP CONSTRAINT "FK_rfp_item_rfp";
        `);

        await queryRunner.query(`DROP TABLE "rfp_proposal";`);

        await queryRunner.query(`DROP INDEX "IDX_rfp_item_rfp";`);

        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rfp_embedding_hnsw";`);

        await queryRunner.query(`DROP TABLE "rfp_item";`);

        await queryRunner.query(`DROP TABLE "rfp";`);

        await queryRunner.query(`DROP TABLE "vendor";`);
    }
}
