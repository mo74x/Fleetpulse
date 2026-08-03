import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialLedgerSchema1722700000000 implements MigrationInterface {
  name = 'InitialLedgerSchema1722700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."accounts_accounttype_enum" AS ENUM(
        'COURIER_CASH_HOLDING',
        'MERCHANT_PAYABLE',
        'PLATFORM_REVENUE'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "accounts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ownerId" character varying(50) NOT NULL,
        "accountType" "public"."accounts_accounttype_enum" NOT NULL,
        "balance" numeric(12,2) NOT NULL DEFAULT '0.00',
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_5a4196b05ab19013fdb36d15c44" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "ledger_entries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "transactionId" uuid NOT NULL,
        "accountId" uuid NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "description" character varying(100) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_b9f67a2164ea2775f0a4f51e0ff" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "ledger_entries"
      ADD CONSTRAINT "FK_b421a1bbcfbcdd02d4fb17585ab"
      FOREIGN KEY ("accountId") REFERENCES "accounts"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ledger_entries" DROP CONSTRAINT "FK_b421a1bbcfbcdd02d4fb17585ab"
    `);
    await queryRunner.query(`DROP TABLE "ledger_entries"`);
    await queryRunner.query(`DROP TABLE "accounts"`);
    await queryRunner.query(`DROP TYPE "public"."accounts_accounttype_enum"`);
  }
}
